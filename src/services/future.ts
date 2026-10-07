import { createHash, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import type { Workspace } from "@/domain/workspace";
import { scenarioRequestSchema, type ScenarioRequest, type FutureScenario } from "@/domain/future";
import type { MutablePalRepository } from "@/repositories/MutablePalRepository";
import { simulateChange } from "@/finance/future";
import { applyAllocation, recordEvent } from "./mutations";
import { moneyFingerprint, PROPOSAL_TTL_MS } from "./proposals";

export function futureFingerprint(state: Workspace) {
  return createHash("sha256").update(JSON.stringify({ money: moneyFingerprint(state), transactions: state.transactions, coverage: state.syncWindow, recurring: state.recurringEvents })).digest("hex");
}
export function createScenarioInState(state: Workspace, input: ScenarioRequest, requestId: string, now: Date): FutureScenario {
  const request = scenarioRequestSchema.parse(input);
  z.string().uuid().parse(requestId);
  const existing = state.futureScenarios.find(s => s.requestId === requestId);
  if (existing) {
    if (!isDeepStrictEqual(existing.request, request)) throw new Error("This request ID was used for another scenario.");
    return existing;
  }
  const preview = simulateChange(state, request);
  const scenario: FutureScenario = { id: randomUUID(), requestId, request, fingerprint: futureFingerprint(state), effects: preview.effects,
    createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + PROPOSAL_TTL_MS).toISOString(), status: "PENDING", message: "Preview only. Nothing has changed." };
  state.futureScenarios.push(scenario);
  recordEvent(state, "PROPOSAL", `Scenario ${scenario.id.slice(0, 8)} created. ${request.kind}. No money or plan changed.`, now.toISOString());
  return scenario;
}
export async function createScenario(repo: MutablePalRepository, userId: string, input: unknown, now = new Date()) {
  const parsed = z.object({ request: scenarioRequestSchema, requestId: z.string().uuid(), replaceId: z.string().optional() }).strict().parse(input);
  return repo.transact(userId, state => {
    if (parsed.replaceId) {
      const old = state.futureScenarios.find(s => s.id === parsed.replaceId);
      if (!old) throw new Error("Scenario not found.");
      // A retried modification returns its original successor, even after resolution.
      const successor = state.futureScenarios.find(s => s.requestId === parsed.requestId);
      if (successor) return createScenarioInState(state, parsed.request, parsed.requestId, now);
      if (old.status !== "PENDING" && old.status !== "EXPIRED") throw new Error("This scenario has already been resolved.");
      old.status = "DISCARDED"; old.message = "Replaced by a modified preview. No change applied.";
      recordEvent(state, "PROPOSAL", `Scenario ${old.id.slice(0, 8)} replaced.`, now.toISOString());
    }
    return createScenarioInState(state, parsed.request, parsed.requestId, now);
  });
}
function stale(state: Workspace, scenario: FutureScenario, now: Date) {
  return now.toISOString() >= scenario.expiresAt || scenario.fingerprint !== futureFingerprint(state);
}
export async function decideScenario(repo: MutablePalRepository, userId: string, input: unknown, now = new Date()) {
  const decision = z.object({ id: z.string(), decision: z.enum(["APPLY", "DISCARD"]) }).strict().parse(input);
  return repo.transact(userId, state => {
    const scenario = state.futureScenarios.find(s => s.id === decision.id);
    if (!scenario) throw new Error("Scenario not found.");
    if (scenario.status === "APPLIED" || scenario.status === "DISCARDED") {
      if ((scenario.status === "APPLIED") === (decision.decision === "APPLY")) return { ok: true, message: "Already resolved. Nothing changed again." };
      throw new Error("This scenario has already been resolved.");
    }
    if (scenario.status === "EXPIRED" || stale(state, scenario, now)) {
      if (scenario.status !== "EXPIRED") recordEvent(state, "PROPOSAL", `Scenario ${scenario.id.slice(0, 8)} expired.`, now.toISOString());
      scenario.status = "EXPIRED"; scenario.message = "Preview expired or the money picture changed. Modify it to create a fresh preview.";
      return { ok: false, message: scenario.message };
    }
    if (decision.decision === "DISCARD") {
      scenario.status = "DISCARDED"; scenario.message = "Discarded. No money or plan changed.";
    } else {
      const preview = simulateChange(state, scenario.request);
      if (!isDeepStrictEqual(preview.effects, scenario.effects)) throw new Error("Impact changed. Create a fresh preview.");
      if (preview.allocations.length) applyAllocation(state, preview.allocations, `Approved scenario ${scenario.id.slice(0, 8)}`, now.toISOString());
      state.buckets = preview.next.buckets;
      state.recurringEvents = preview.next.recurringEvents;
      scenario.status = "APPLIED"; scenario.message = "Approved change saved. No external payment or automatic contribution was made.";
    }
    recordEvent(state, "PROPOSAL", `Scenario ${scenario.id.slice(0, 8)} ${scenario.status.toLowerCase()}: ${scenario.effects.join(" ")}`, now.toISOString());
    return { ok: true, message: scenario.message };
  });
}
export async function readFuture(repo: MutablePalRepository, userId: string, now = new Date()) {
  await repo.transact(userId, state => {
    for (const s of state.futureScenarios) if (s.status === "PENDING" && stale(state, s, now)) {
      s.status = "EXPIRED"; s.message = "Expired or money picture changed. Modify for a fresh preview.";
      recordEvent(state, "PROPOSAL", `Scenario ${s.id.slice(0, 8)} expired.`, now.toISOString());
    }
  });
  return repo.read(userId);
}
