import { randomUUID } from "node:crypto";
import type { Workspace } from "@/domain/workspace";
import type { Clarification } from "@/domain/future";
import type { MutablePalRepository } from "@/repositories/MutablePalRepository";
import { compareMonthlyPass } from "@/finance/pass-analysis";
import { parseMoneyInput } from "@/lib/money-input";
import { money } from "@/lib/format";
import { createScenarioInState, futureFingerprint } from "./future";
import { PROPOSAL_TTL_MS } from "./proposals";

export type CopilotReply = {
  answer: string; mode: string; notice: string; asOf: string; proposalId: string | null;
  scenarioId?: string | null; clarificationId?: string | null; choices?: { value: string; label: string }[];
  analysisId?: string | null;
  status?: "ANSWER" | "CLARIFICATION" | "UNSUPPORTED" | "AI_FAILURE" | "PREVIEW";
};
export type EnhancedRequest = { kind: "PASS" | "BUDGET"; amountCents: number; bucketId: string | null; sourceGoalId: string | null };
const norm = (s: string) => s.trim().toLowerCase();
function response(state: Workspace, answer: string, status: CopilotReply["status"] = "ANSWER"): CopilotReply {
  return { answer, status, mode: "Pal calculation", notice: "Local rules interpret this supported request. All amounts are calculated by Pal; no paid API is used.", asOf: state.asOf, proposalId: null };
}
function questionFor(state: Workspace, c: Clarification): CopilotReply {
  if (c.step === "DONE") return { ...response(state, c.answer ?? "This request was resolved."), scenarioId: c.scenarioId, status: c.scenarioId ? "PREVIEW" : "ANSWER" };
  if (c.step === "BUDGET_CHOICE") {
    const bucket = state.buckets.find(b => b.id === c.bucketId)!;
    const goals = state.buckets.filter(b => b.type === "GOAL" && b.status === "ACTIVE" && (!c.sourceGoalId || b.id === c.sourceGoalId));
    return { ...response(state, `${bucket.name} is a spending budget. Should I increase its allowance by ${money(c.amountCents)} for this period only, or also withdraw that amount from a savings goal? Increasing the limit alone creates no cash. I will show the impact before you approve.`, "CLARIFICATION"), clarificationId: c.id,
      choices: [{ value: "limit", label: "Increase the limit only" }, ...goals.map(g => ({ value: `source:${g.id}`, label: `Also withdraw from ${g.name} savings` })), { value: "cancel", label: "Cancel request" }] };
  }
  if (c.step === "MERCHANTS") return { ...response(state, `Which of these Transport merchants represents journeys covered by the ${money(c.amountCents)} monthly pass? Transport can include taxis; I will not assume every Transport purchase is public transit. Choose one merchant, all listed merchants, or type several exact merchant names separated by commas.`, "CLARIFICATION"), clarificationId: c.id,
    choices: [...c.merchants.map(m => ({ value: `merchant:${m}`, label: m })), { value: "all", label: "Use all listed merchants" }, { value: "cancel", label: "Cancel request" }] };
  return { ...response(state, `For ${c.selectedMerchants.join(", ")}, may I assume a ${money(c.amountCents)} pass covers all those journeys for a full month, with no extra fares, and that your usage stays similar? This compares full-month costs, not buying a pass just for the days remaining.`, "CLARIFICATION"), clarificationId: c.id,
    choices: [{ value: "covered", label: "Yes, compare with those assumptions" }, { value: "cancel", label: "No / cancel comparison" }] };
}
export function pendingClarification(state: Workspace, now = new Date()): CopilotReply | null {
  const c = [...state.clarifications].reverse().find(c => c.step !== "DONE" && c.expiresAt > now.toISOString() && c.fingerprint === futureFingerprint(state));
  return c ? questionFor(state, c) : null;
}

/** Recognize supported money questions without allowing text to become a mutation command. */
export function detectEnhancedRequest(state: Workspace, question: string) {
  if (/\b(every|automatically|weekly|percent|don't|not|decrease|reduce)\b|%|[-−]\s*\$?\d|\d,\d/i.test(question)) return null;
  const amounts = [...question.matchAll(/(?:\$\s*(\d+(?:\.\d+)?)\b|(\d+(?:\.\d+)?)\s*(?:dollars?|usd)\b)/gi)].map(m => m[1] ?? m[2]);
  if (amounts.length !== 1) return null;
  const amountCents = parseMoneyInput(amounts[0]);
  if (amountCents <= 0) return null;
  if (/\b(monthly|month)\b/i.test(question) && /\b(pass|concession)\b/i.test(question) && /transport|transit|bus|train|subway/i.test(question)) return { kind: "PASS" as const, amountCents, bucketId: null, sourceGoalId: null };
  if (!/\b(add|increase|raise|put|allow|move)\b/i.test(question)) return null;
  const budgets = state.buckets.filter(b => b.status === "ACTIVE" && b.type === "SPENDING" && norm(question).includes(norm(b.name)));
  const goals = state.buckets.filter(b => b.status === "ACTIVE" && b.type === "GOAL" && norm(question).includes(norm(b.name)));
  if (budgets.length !== 1 || goals.length > 1) return null;
  // "Set to" is an absolute limit, not an increase. Never silently treat it as a delta.
  if (/\b(set|total|instead of|from \$?\d)\b/i.test(question)) return null;
  return { kind: "BUDGET" as const, amountCents, bucketId: budgets[0].id, sourceGoalId: goals[0]?.id ?? null };
}

export async function enhancedCopilot(repo: MutablePalRepository, userId: string, question: string, requestId: string, clarificationId?: string | null, now = new Date(), interpreted?: EnhancedRequest | null): Promise<CopilotReply | null> {
  const initial = await repo.read(userId);
  const detected = clarificationId ? null : interpreted ?? detectEnhancedRequest(initial, question);
  if (!clarificationId && !detected) return null;
  return repo.transact(userId, state => {
    let c = clarificationId ? state.clarifications.find(c => c.id === clarificationId) : state.clarifications.find(c => c.requestId === requestId);
    if (clarificationId && !c) return response(state, "That follow-up is unavailable in this session. Ask the original question again.", "UNSUPPORTED");
    if (!c) {
      if (!detected) return null;
      const merchants = [...new Set(state.transactions.filter(t => t.category === "Transport" && t.direction === "OUT" && t.status === "COMPLETED" && t.transactionType === "PURCHASE" && t.transactionDate <= state.asOf).map(t => t.normalizedMerchant))].sort();
      if (detected.kind === "PASS" && !merchants.length) return response(state, "I need identifiable public-transport purchases first. Review their categories in Transactions, assign Transport, sync, and ask again. I will not infer usage from a missing history.", "UNSUPPORTED");
      c = { id: randomUUID(), requestId, question, fingerprint: futureFingerprint(state), expiresAt: new Date(now.getTime() + PROPOSAL_TTL_MS).toISOString(),
        ...detected, merchants, selectedMerchants: [], step: detected.kind === "BUDGET" ? "BUDGET_CHOICE" : "MERCHANTS", scenarioId: null, answer: null };
      state.clarifications.push(c);
      return questionFor(state, c);
    }
    if (!clarificationId) {
      if (c.question !== question) throw new Error("This request ID belongs to another question.");
      return questionFor(state, c);
    }
    if (c.step === "DONE") return questionFor(state, c);
    if (now.toISOString() >= c.expiresAt || c.fingerprint !== futureFingerprint(state)) {
      c.step = "DONE"; c.answer = "The clarification expired or your money picture changed. Ask the original question again.";
      return questionFor(state, c);
    }
    const choices = questionFor(state, c).choices ?? [];
    let value = choices.find(choice => norm(choice.value) === norm(question) || norm(choice.label) === norm(question))?.value;
    if (/^(cancel|no|stop)$/i.test(question.trim())) value = "cancel";
    if (value === "cancel") { c.step = "DONE"; c.answer = "Cancelled. Nothing changed."; return questionFor(state, c); }
    if (c.step === "BUDGET_CHOICE") {
      if (/^(only|limit only|only increase (the )?(budget|limit))$/i.test(question.trim())) value = "limit";
      if (/^(both|yes both)$/i.test(question.trim()) && c.sourceGoalId) value = `source:${c.sourceGoalId}`;
      if (!value || (value !== "limit" && !value.startsWith("source:"))) return questionFor(state, c);
      const sourceGoalId = value === "limit" ? null : value.slice(7);
      if (sourceGoalId && !choices.some(choice => choice.value === value)) return questionFor(state, c);
      const scenario = createScenarioInState(state, { kind: "BUDGET", bucketId: c.bucketId!, increaseCents: c.amountCents, sourceGoalId }, c.requestId, now);
      c.step = "DONE"; c.scenarioId = scenario.id; c.answer = "Your clarified change is ready to review. Check the allowance, savings and Safe to Spend impacts, then approve or discard it. Nothing has changed yet.";
      return questionFor(state, c);
    }
    if (c.step === "MERCHANTS") {
      const named = question.split(",").map(name => c!.merchants.find(m => norm(m) === norm(name)));
      const selected = value === "all" ? c.merchants : value?.startsWith("merchant:") ? [value.slice(9)] : named.every(Boolean) ? named as string[] : [];
      if (!selected.length) return questionFor(state, c);
      c.selectedMerchants = [...new Set(selected)]; c.step = "COVERAGE";
      return questionFor(state, c);
    }
    if (value === "covered" || /^(yes|yes please|yes,? compare)$/i.test(question.trim())) {
      c.answer = compareMonthlyPass(state, c.selectedMerchants, c.amountCents); c.step = "DONE";
      return questionFor(state, c);
    }
    return questionFor(state, c);
  });
}
