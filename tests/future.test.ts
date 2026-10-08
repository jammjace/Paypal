import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { createDemoFixture } from "@/fixtures/demo";
import { workspaceFromSnapshot } from "@/domain/workspace";
import type { ScenarioRequest } from "@/domain/future";
import { SqlitePalRepository } from "@/repositories/SqlitePalRepository";
import { calendarOccurrence, projectFuture, simulateChange } from "@/finance/future";
import { compareMonthlyPass } from "@/finance/pass-analysis";
import { bucketProgress } from "@/finance/buckets";
import { createScenario, decideScenario, readFuture } from "@/services/future";
import { detectEnhancedRequest, enhancedCopilot, pendingClarification } from "@/services/copilot";
import { askPal } from "@/server/ai/pal";
import type { MutablePalRepository } from "@/repositories/MutablePalRepository";
import { interpretCopilot } from "@/server/ai/copilot";
import { z } from "zod";
import type { StructuredInterpreter } from "@/server/ai/structured";

const owner = "future-owner", now = new Date("2026-10-07T12:00:00.000Z");
const budget: ScenarioRequest = { kind: "BUDGET", bucketId: "coffee", increaseCents: 6000, sourceGoalId: "christmas" };
const budgetQuestion = "i will put more money into coffee than christmas gifts. help me add $60 to coffee";
const passQuestion = "at the rate i am spending money on public transportation, is it better for me to get a monthly concession pass of 90 dollars instead?";
function fixture(userId = owner) {
  const state = workspaceFromSnapshot(createDemoFixture({ userId, accountId: `a-${userId}`, connectionId: `c-${userId}` }, "2026-10-15T18:00:00.000Z"));
  state.syncWindow = { from: "2026-09-01T00:00:00.000Z", to: "2026-10-15T18:00:00.001Z" };
  return state;
}
const root = resolve(".local/tests"), dirs: string[] = [];
async function setup() {
  mkdirSync(root, { recursive: true }); const dir = mkdtempSync(join(root, "future-")); dirs.push(dir);
  const repo = new SqlitePalRepository(join(dir, "pal.sqlite")); await repo.initialize(fixture()); return repo;
}
afterEach(() => { for (const dir of dirs.splice(0)) { if (!resolve(dir).startsWith(root + sep)) throw new Error("Unsafe test path"); rmSync(dir, { recursive: true, force: true }); } });
const preview = (repo: SqlitePalRepository, request: ScenarioRequest = budget, requestId = randomUUID()) => createScenario(repo, owner, { request, requestId }, now);

describe("calendar projections and isolated simulation", () => {
  it("anchors month ends through leap years and across years", () => {
    expect(calendarOccurrence("2028-01-31T12:00:00.000Z", 1)).toBe("2028-02-29T12:00:00.000Z");
    expect(calendarOccurrence("2028-01-31T12:00:00.000Z", 2)).toBe("2028-03-31T12:00:00.000Z");
    expect(calendarOccurrence("2026-12-31T12:00:00.000Z", 2)).toBe("2027-02-28T12:00:00.000Z");
  });
  it("simulates current-period budget changes without inventing cash or mutating input", () => {
    const state = fixture(), before = structuredClone(state);
    const impact = simulateChange(state, { ...budget, sourceGoalId: null });
    expect(impact.after).toEqual(impact.before);
    expect(state).toEqual(before);
    const coffee = impact.next.buckets.find(b => b.id === "coffee")!;
    expect(bucketProgress(coffee, state.transactions, state.asOf)).toMatchObject({ limitCents: 16000, remainingCents: 7540 });
    expect(bucketProgress(coffee, state.transactions, "2026-11-01T12:00:00.000Z")).toMatchObject({ limitCents: 10000 });
    expect(impact.next.buckets.find(b => b.id === "christmas")?.allocatedAmountCents).toBe(26000);
  });
  it("combines a release with a temporary allowance, leaving account balance unchanged", () => {
    const result = simulateChange(fixture(), budget);
    expect(result.after).toEqual({ balanceCents: 243000, earmarkedCents: 182000, safeToSpendCents: 61000 });
    expect(result.next.buckets.find(b => b.id === "christmas")?.allocatedAmountCents).toBe(20000);
  });
  it("rejects overspending and invalid source/destination types", () => {
    expect(() => simulateChange(fixture(), { ...budget, increaseCents: 27000 })).toThrow();
    expect(() => simulateChange(fixture(), { ...budget, sourceGoalId: "coffee" })).toThrow();
    expect(() => simulateChange(fixture(), { ...budget, bucketId: "travel" })).toThrow();
  });
  it("contributions reserve cash without changing balance and stop at target", () => {
    const state = fixture(); state.buckets = state.buckets.filter(b => b.id === "travel");
    const before = structuredClone(state), projection = projectFuture(state, 3);
    expect(projection.final.balanceCents).toBe(243000);
    expect(projection.goals[0].projectedCents).toBe(100000);
    expect(projection.goals[0].fundedAt).toBe("2027-01-01T23:59:59.000Z");
    expect(projection.timeline.map(e => e.appliedCents)).toEqual([20000, 20000, 18000]);
    expect(state).toEqual(before);
  });
  it("shows unfunded contributions and negative cash rather than silently manufacturing income", () => {
    const state = fixture(); state.account.currentBalanceCents = 180000;
    state.recurringEvents.push({ id: "bill", name: "Bill", amountCents: 5000, direction: "OUT", recurrence: "ONCE", startDate: "2026-11-01T12:00:00.000Z" });
    const p = projectFuture(state, 1);
    expect(p.final.balanceCents).toBe(175000);
    expect(p.final.safeToSpendCents).toBe(-13000);
    expect(p.timeline.some(e => e.shortfallCents > 0)).toBe(true);
    expect(p.timeline.filter(e => e.direction === "SAVE").every(e => e.appliedCents === 0)).toBe(true);
  });
  it("recurs from old anchors without replaying past events and removes events only in simulation", () => {
    const state = fixture(); state.recurringEvents.push({ id: "pay", name: "Pay", direction: "IN", amountCents: 10000, recurrence: "MONTHLY", startDate: "2020-01-31T12:00:00.000Z" });
    const p = projectFuture(state, 2);
    expect(p.timeline.filter(e => e.direction === "IN").map(e => e.date)).toEqual(["2026-10-31T12:00:00.000Z", "2026-11-30T12:00:00.000Z", "2026-12-31T12:00:00.000Z"]);
    expect(simulateChange(state, { kind: "REMOVE_EVENT", eventId: "pay" }).next.recurringEvents).toEqual([]);
    expect(state.recurringEvents).toHaveLength(1);
  });
});

describe("scenario persistence and approval", () => {
  it("rejects recurring plans whose cumulative money exceeds safe integer bounds", async () => {
    const repo = await setup(), before = await repo.read(owner);
    await expect(preview(repo, { kind: "EVENT", event: { id: "huge", name: "Huge", direction: "IN", amountCents: Number.MAX_SAFE_INTEGER, recurrence: "MONTHLY", startDate: "2026-11-01T12:00:00.000Z" } })).rejects.toThrow("supported range");
    expect(await repo.read(owner)).toEqual(before);
  });
  it("applies a combined change once with allocations and audit in the same commit", async () => {
    const repo = await setup(), before = await repo.read(owner), scenario = await preview(repo);
    expect((await repo.read(owner)).buckets).toEqual(before.buckets);
    const decision = { id: scenario.id, decision: "APPLY" };
    await decideScenario(repo, owner, decision, now);
    const saved = await new SqlitePalRepository(repo.filename).read(owner);
    expect(saved.futureScenarios[0].status).toBe("APPLIED");
    expect(saved.activity.at(-1)?.deltaCents).toBe(-6000);
    expect(saved.events.at(-1)?.reason).toContain("Coffee limit");
    await decideScenario(repo, owner, decision, now);
    expect(await repo.read(owner)).toEqual(saved);
  });
  it("discard and modification never apply the old preview", async () => {
    const repo = await setup(), first = await preview(repo), before = (await repo.read(owner)).buckets;
    const next = await createScenario(repo, owner, { request: { ...budget, increaseCents: 1000 }, requestId: randomUUID(), replaceId: first.id }, now);
    expect((await repo.read(owner)).futureScenarios[0].status).toBe("DISCARDED");
    await expect(decideScenario(repo, owner, { id: first.id, decision: "APPLY" }, now)).rejects.toThrow("resolved");
    await decideScenario(repo, owner, { id: next.id, decision: "DISCARD" }, now);
    expect((await repo.read(owner)).buckets).toEqual(before);
  });
  it.each(["time", "classification", "balance", "plan"])("expires on %s changes", async mode => {
    const repo = await setup(), scenario = await preview(repo);
    await repo.transact(owner, state => {
      if (mode === "classification") state.transactions[0].category = "Other";
      if (mode === "balance") state.account.currentBalanceCents--;
      if (mode === "plan") state.recurringEvents.push({ id: "x", name: "X", direction: "IN", recurrence: "ONCE", amountCents: 1, startDate: "2026-11-01T12:00:00.000Z" });
    });
    const before = await repo.read(owner), when = mode === "time" ? new Date(now.getTime() + 900000) : now;
    expect((await decideScenario(repo, owner, { id: scenario.id, decision: "APPLY" }, when)).ok).toBe(false);
    expect((await readFuture(repo, owner, when)).futureScenarios[0].status).toBe("EXPIRED");
    expect((await repo.read(owner)).buckets).toEqual(before.buckets);
  });
  it("rejects foreign proposals, extra amounts, changed replay payloads and rolls back on failure", async () => {
    const repo = await setup(), id = randomUUID(), scenario = await preview(repo, budget, id);
    await repo.initialize(fixture("other"));
    await expect(decideScenario(repo, "other", { id: scenario.id, decision: "APPLY" }, now)).rejects.toThrow("not found");
    await expect(decideScenario(repo, owner, { id: scenario.id, decision: "APPLY", increaseCents: 1 }, now)).rejects.toThrow();
    await expect(preview(repo, { ...budget, increaseCents: 1 }, id)).rejects.toThrow("another scenario");
    const before = await repo.read(owner);
    const failing: MutablePalRepository = { read: u => repo.read(u), replaceFinancialSnapshot: (u, s) => repo.replaceFinancialSnapshot(u, s), transact: (u, op) => repo.transact(u, s => { op(s); throw new Error("commit failed"); }) };
    await expect(decideScenario(failing, owner, { id: scenario.id, decision: "APPLY" }, now)).rejects.toThrow("commit failed");
    expect(await repo.read(owner)).toEqual(before);
  });
  it("does not execute a monthly plan or income event when approved", async () => {
    const repo = await setup(), before = await repo.read(owner);
    const s = await preview(repo, { kind: "EVENT", event: { id: "pay", name: "Paycheck", amountCents: 100000, direction: "IN", recurrence: "MONTHLY", startDate: "2026-11-01T12:00:00.000Z" } });
    await decideScenario(repo, owner, { id: s.id, decision: "APPLY" }, now);
    const saved = await repo.read(owner);
    expect(saved.account).toEqual(before.account); expect(saved.buckets).toEqual(before.buckets); expect(saved.recurringEvents).toHaveLength(1);
  });
});

describe("clarification and pass analysis", () => {
  it("accepts grounded model intents and falls back safely on invented amounts", async () => {
    const fake = (value: unknown): StructuredInterpreter => ({ generate: async <T>(schema: z.ZodType<T>) => schema.parse(value) });
    const intent = { intent: "BUDGET_INCREASE", amount: "60", budget: "Coffee", sourceGoal: "Christmas" };
    const valid = await interpretCopilot(fixture(), budgetQuestion, fake(intent));
    expect(valid.mode).toBe("Local AI (Qwen3 4B)");
    expect(valid.request).toMatchObject({ amountCents: 6000, sourceGoalId: "christmas" });
    const invalid = await interpretCopilot(fixture(), budgetQuestion, fake({ ...intent, amount: "600" }));
    expect(invalid.mode).toBe("Local fallback");
    expect(invalid.request?.amountCents).toBe(6000);
  });
  it.each(["Do not add $60 to Coffee", "Set Coffee to $60 total", "Add $60 and $20 to Coffee", "Add $1,000 to Coffee", "Add $-60 to Coffee"])("does not reinterpret an ambiguous or negated delta: %s", question => {
    expect(detectEnhancedRequest(fixture(), question)).toBeNull();
  });
  it("recognizes both original prompts as distinct supported intents", () => {
    expect(detectEnhancedRequest(fixture(), budgetQuestion)).toMatchObject({ kind: "BUDGET", amountCents: 6000, bucketId: "coffee", sourceGoalId: "christmas" });
    expect(detectEnhancedRequest(fixture(), passQuestion)).toMatchObject({ kind: "PASS", amountCents: 9000 });
  });
  it("persists clarification, understands 'both', and creates a preview rather than moving money", async () => {
    const repo = await setup(), before = await repo.read(owner);
    const first = (await enhancedCopilot(repo, owner, budgetQuestion, randomUUID(), null, now))!;
    expect(first.status).toBe("CLARIFICATION");
    expect(pendingClarification(await new SqlitePalRepository(repo.filename).read(owner), now)?.clarificationId).toBe(first.clarificationId);
    const unclear = await enhancedCopilot(repo, owner, "yes", randomUUID(), first.clarificationId, now);
    expect(unclear?.status).toBe("CLARIFICATION");
    const reply = (await enhancedCopilot(repo, owner, "both", randomUUID(), first.clarificationId, now))!;
    expect(reply.scenarioId).toBeTruthy();
    expect((await repo.read(owner)).buckets).toEqual(before.buckets);
    const replay = await enhancedCopilot(repo, owner, "both", randomUUID(), first.clarificationId, now);
    expect(replay?.scenarioId).toBe(reply.scenarioId);
    expect((await repo.read(owner)).futureScenarios).toHaveLength(1);
  });
  it("isolates follow-ups by owner and refuses stale clarifications", async () => {
    const repo = await setup(); await repo.initialize(fixture("other"));
    const first = (await enhancedCopilot(repo, owner, budgetQuestion, randomUUID(), null, now))!;
    expect((await enhancedCopilot(repo, "other", "both", randomUUID(), first.clarificationId, now))?.status).toBe("UNSUPPORTED");
    await repo.transact(owner, s => { s.account.currentBalanceCents--; });
    expect((await enhancedCopilot(repo, owner, "both", randomUUID(), first.clarificationId, now))?.answer).toContain("changed");
    expect((await repo.read(owner)).futureScenarios).toHaveLength(0);
  });
  it("asks about merchant scope and coverage before a comparison, without any financial mutation", async () => {
    const repo = await setup(), before = await repo.read(owner);
    const first = (await enhancedCopilot(repo, owner, passQuestion, randomUUID(), null, now))!;
    expect(first.answer).toContain("taxis");
    const second = (await enhancedCopilot(repo, owner, "all", randomUUID(), first.clarificationId, now))!;
    expect(second.answer).toContain("covers all");
    const final = (await enhancedCopilot(repo, owner, "yes", randomUUID(), first.clarificationId, now))!;
    expect(final.answer).toContain("$177.14"); // $80 / 14 completed days * 31, rounded cents.
    expect(final.answer).toContain("$87.14");
    expect(final.answer).toContain("assuming");
    expect((await repo.read(owner)).buckets).toEqual(before.buckets);
    expect((await repo.read(owner)).account).toEqual(before.account);
  });
  it("excludes other merchants and today's partial data, and refuses missing coverage", () => {
    const state = fixture(), template = state.transactions.find(t => t.category === "Transport")!;
    state.transactions = [
      { ...template, id: "one", providerTransactionId: "one", normalizedMerchant: "City Transit", amountCents: 2800, transactionDate: "2026-10-02T12:00:00.000Z" },
      { ...template, id: "two", providerTransactionId: "two", normalizedMerchant: "Taxi", amountCents: 50000, transactionDate: "2026-10-03T12:00:00.000Z" },
      { ...template, id: "three", providerTransactionId: "three", normalizedMerchant: "City Transit", amountCents: 10000, transactionDate: state.asOf },
    ];
    expect(compareMonthlyPass(state, ["City Transit"], 9000)).toContain("$62.00");
    expect(compareMonthlyPass(state, ["City Transit"], 9000)).toContain("$28.00 more");
    state.syncWindow = null;
    expect(compareMonthlyPass(state, ["City Transit"], 9000)).toContain("coverage");
  });
  it("distinguishes model failures from unsupported questions", async () => {
    expect((await askPal(fixture(), "Predict tomorrow's stocks", null)).status).toBe("UNSUPPORTED");
    const failed = await askPal(fixture(), "Compare this month", { generate: async () => { throw new DOMException("Timeout", "TimeoutError"); } });
    expect(failed.status).toBe("AI_FAILURE"); expect(failed.notice).toContain("timed out");
  });
});
