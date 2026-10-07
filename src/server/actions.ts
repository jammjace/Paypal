"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CommandError, executeCommand } from "@/services/commands";
import { currentContext, SESSION_COOKIE } from "./context";
import { createDemoSession, resetDemo, syncWorkspace } from "./demo";
import { askPal, configuredInterpreter } from "./ai/pal";
import { readConfig } from "./config";
import { createProposal, moneyFingerprint, ProposalError, resolveProposal } from "@/services/proposals";
import { reallocationRequestSchema } from "@/domain/proposals";
import { enhancedCopilot, type CopilotReply } from "@/services/copilot";
import { createScenario, decideScenario } from "@/services/future";
import { interpretCopilot } from "./ai/copilot";

export type ActionResult = { ok: boolean; message: string };
export async function startDemoAction() {
  const existing = await currentContext();
  if (!existing) {
    const token = await createDemoSession();
    (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: readConfig().PAL_COOKIE_SECURE === "true", path: "/", maxAge: 30 * 86400 });
  }
  redirect("/pal");
}
export async function mutateAction(input: unknown): Promise<ActionResult> {
  const context = await currentContext();
  if (!context) return { ok: false, message: "Your demo session expired. Open Pal again to start a session." };
  try {
    const message = await executeCommand(context.repository, context.userId, input);
    revalidatePath("/pal", "layout");
    return { ok: true, message };
  } catch (error) {
    return { ok: false, message: error instanceof CommandError ? error.message : error instanceof z.ZodError ? "Check the required fields, dates and amounts." : "Unable to save. Check the amount, then refresh and try again." };
  }
}
export async function syncAction(): Promise<ActionResult> {
  const context = await currentContext();
  if (!context) return { ok: false, message: "Your session expired." };
  try {
    await syncWorkspace(context.repository, context.userId);
    revalidatePath("/pal", "layout");
    return { ok: true, message: "Transactions synced. Your classifications and buckets were preserved." };
  } catch { return { ok: false, message: "Sync failed. Your saved money picture has been preserved." }; }
}
export async function resetDemoAction() {
  const context = await currentContext();
  if (!context) redirect("/pal");
  await resetDemo(context.repository, context.userId);
  revalidatePath("/pal", "layout");
  redirect("/pal");
}

export async function askPalAction(input: unknown): Promise<CopilotReply> {
  const { question, requestId, clarificationId } = z.object({ question: z.string().trim().min(1).max(500), requestId: z.string().uuid(), clarificationId: z.string().nullable().optional() }).strict().parse(input);
  const context = await currentContext();
  if (!context) throw new Error("Session expired. Refresh Pal.");
  try {
    const interpreted = clarificationId ? null : await interpretCopilot(await context.repository.read(context.userId), question, configuredInterpreter());
    const enhanced = await enhancedCopilot(context.repository, context.userId, question, requestId, clarificationId, new Date(), interpreted?.request);
    if (enhanced) {
      if (enhanced.scenarioId) revalidatePath("/pal/future");
      return interpreted ? { ...enhanced, mode: interpreted.mode, notice: interpreted.notice } : enhanced;
    }
  } catch (error) {
    return { answer: error instanceof Error ? error.message : "Unable to prepare this request.", mode: "Pal calculation", notice: "No change was applied. Try a smaller amount or review your sources.", status: "UNSUPPORTED", asOf: (await context.repository.read(context.userId)).asOf, proposalId: null };
  }
  const state = await context.repository.read(context.userId);
  const result = await askPal(state, question, configuredInterpreter());
  if (!result.actionDraft) return { ...result, proposalId: null };
  try {
    const proposal = await createProposal(context.repository, context.userId, result.actionDraft, requestId, moneyFingerprint(state));
    revalidatePath("/pal/actions");
    return { ...result, proposalId: proposal.id };
  } catch (error) {
    return { ...result, proposalId: null, answer: error instanceof ProposalError ? error.message : "Unable to create a preview. Open Review changes and try again." };
  }
}

export async function previewFutureAction(input: unknown): Promise<ActionResult> {
  const context = await currentContext();
  if (!context) return { ok: false, message: "Session expired. Refresh Pal." };
  try {
    await createScenario(context.repository, context.userId, input);
    revalidatePath("/pal/future");
    return { ok: true, message: "Scenario ready below. Review its impact before applying." };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Unable to preview this change." }; }
}
export async function decideFutureAction(input: unknown): Promise<ActionResult> {
  const context = await currentContext();
  if (!context) return { ok: false, message: "Session expired. Refresh Pal." };
  try {
    const result = await decideScenario(context.repository, context.userId, input);
    revalidatePath("/pal", "layout");
    return result;
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Unable to apply this scenario." }; }
}

export async function previewSavingsAction(input: unknown): Promise<ActionResult> {
  const context = await currentContext();
  if (!context) return { ok: false, message: "Session expired. Refresh Pal." };
  try {
    const parsed = z.object({ request: reallocationRequestSchema, requestId: z.string().uuid() }).strict().parse(input);
    const state = await context.repository.read(context.userId);
    await createProposal(context.repository, context.userId, parsed.request, parsed.requestId, moneyFingerprint(state));
    revalidatePath("/pal/actions");
    return { ok: true, message: "Preview created below. No money moved. Choose one option to approve." };
  } catch (error) { return { ok: false, message: error instanceof ProposalError ? error.message : "Check the goals and amount, then try again." }; }
}
export async function decideProposalAction(input: unknown): Promise<ActionResult> {
  const context = await currentContext();
  if (!context) return { ok: false, message: "Session expired. Refresh Pal." };
  try {
    const result = await resolveProposal(context.repository, context.userId, input);
    revalidatePath("/pal", "layout");
    return result;
  } catch (error) { return { ok: false, message: error instanceof ProposalError ? error.message : "Unable to approve. Refresh and review the preview again." }; }
}
