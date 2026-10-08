import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Workspace } from "@/domain/workspace";
import type { AnalysisThread } from "@/domain/analysis";
import type { MutablePalRepository } from "@/repositories/MutablePalRepository";
import type { StructuredInterpreter } from "@/server/ai/structured";
import { planAnalysis } from "@/server/ai/analysis";
import { runAnalysis } from "@/finance/analysis";
import { futureFingerprint } from "./future";
import type { CopilotReply } from "./copilot";
const TTL = 15 * 60 * 1000;
function reply(thread: AnalysisThread): CopilotReply {
  return { ...thread.lastReply, status: thread.pending ? "CLARIFICATION" : "ANSWER", proposalId: null, analysisId: thread.closed ? null : thread.id };
}
export function pendingAnalysis(state: Workspace, now = new Date()) {
  const thread = [...state.analysisThreads].reverse().find(t => t.pending && !t.closed && t.expiresAt > now.toISOString());
  return thread ? reply(thread) : null;
}
export async function answerAnalysis(repo: MutablePalRepository, userId: string, question: string, requestId: string, analysisId: string | null, interpreter: StructuredInterpreter | null, now = new Date()): Promise<CopilotReply> {
  z.string().uuid().parse(requestId);
  const state = await repo.read(userId), old = analysisId ? state.analysisThreads.find(t => t.id === analysisId) : state.analysisThreads.find(t => t.requestId === requestId);
  const message = (answer: string): CopilotReply => ({ answer, mode: "Pal calculation", notice: "No financial state was changed.", asOf: state.asOf, proposalId: null, status: "CLARIFICATION" });
  if (analysisId && (!old || old.closed || old.expiresAt <= now.toISOString())) return message("That analysis thread expired or is unavailable in this session. Start a new question using the current data.");
  if (old?.messages.some(m => m.requestId === requestId)) {
    if (old.messages.find(m => m.requestId === requestId)!.question !== question) return message("This request ID belongs to a different question.");
    return reply(old);
  }
  if (old && /^(cancel|stop)$/i.test(question.trim())) {
    await repo.transact(userId, current => { const t = current.analysisThreads.find(t => t.id === old.id)!; t.closed = true; t.pending = false; });
    return { ...message("Analysis closed. Ask a new question whenever you are ready."), status: "ANSWER" };
  }
  if (old && old.messages.length >= 8) return message("This thread has reached its follow-up limit. Start a new question so I can use fresh context.");
  const interpreted = await planAnalysis(state, question, old?.messages ?? [], old?.plan ?? null, interpreter);
  const userText = [...(old?.messages.map(m => m.question) ?? []), question].join("\n");
  let result;
  try { result = runAnalysis(state, interpreted.plan, userText); }
  catch (error) { result = { answer: error instanceof Error ? error.message : "I need more information to calculate this safely.", pending: true, choices: [] }; }
  return repo.transact(userId, current => {
    if (futureFingerprint(current) !== futureFingerprint(state)) return message("Your money picture changed while I was calculating. Ask again for an analysis of the updated data.");
    let thread = old ? current.analysisThreads.find(t => t.id === old.id) : current.analysisThreads.find(t => t.requestId === requestId);
    if (thread?.messages.some(m => m.requestId === requestId)) return reply(thread);
    if (thread && (thread.closed || thread.messages.length !== old?.messages.length)) return message("This conversation changed in another request. Refresh before continuing.");
    const lastReply = { answer: result.answer, mode: interpreted.mode, notice: interpreted.notice, asOf: current.asOf, choices: result.choices };
    if (!thread) {
      thread = { id: randomUUID(), requestId, expiresAt: new Date(now.getTime() + TTL).toISOString(), messages: [], plan: interpreted.plan, pending: result.pending, closed: false, lastReply };
      current.analysisThreads.push(thread);
    }
    thread.plan = interpreted.plan; thread.lastReply = lastReply; thread.pending = result.pending;
    thread.messages.push({ question, requestId, answer: result.answer });
    return reply(thread);
  });
}
