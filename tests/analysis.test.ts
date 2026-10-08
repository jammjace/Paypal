import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { resolve, join, sep } from "node:path";
import { createDemoFixture } from "@/fixtures/demo";
import { workspaceFromSnapshot } from "@/domain/workspace";
import { analysisStep, explicitChangeRequest, planAnalysis } from "@/server/ai/analysis";
import { runAnalysis, analysisConsents } from "@/finance/analysis";
import { answerAnalysis } from "@/services/analysis";
import type { AnalysisPlan } from "@/domain/analysis";
import { SqlitePalRepository } from "@/repositories/SqlitePalRepository";
import type { StructuredInterpreter } from "@/server/ai/structured";

const owner = "analysis-owner", now = new Date("2026-10-08T12:00:00.000Z");
function fixture(userId = owner) {
  const s = workspaceFromSnapshot(createDemoFixture({ userId, accountId: `a-${userId}`, connectionId: `c-${userId}` }, "2026-10-15T18:00:00.000Z"));
  s.syncWindow = { from: "2026-09-01T00:00:00.000Z", to: "2026-10-15T18:00:00.001Z" }; return s;
}
const plan = (...steps: AnalysisPlan["steps"]): AnalysisPlan => ({ steps, clarification: null });
const fake = (p: AnalysisPlan): StructuredInterpreter => ({ generate: async <T>(schema: z.ZodType<T>) => schema.parse(p) });
const root = resolve(".local/tests"), dirs: string[] = [];
async function setup() { mkdirSync(root, { recursive: true }); const d = mkdtempSync(join(root, "analysis-")); dirs.push(d); const r = new SqlitePalRepository(join(d, "pal.sqlite")); await r.initialize(fixture()); return r; }
afterEach(() => { for (const d of dirs.splice(0)) { if (!resolve(d).startsWith(root + sep)) throw new Error("Unsafe cleanup"); rmSync(d, { recursive: true, force: true }); } });

describe("analysis and action boundary", () => {
  it.each([
    "at the rate i have been buying coffee from luckin, should i get a monthly $50 subscription instead",
    "Should I move $200 to Travel?", "Would increasing Coffee by $60 be sensible?", "Can I afford to add $75 to my monthly costs?",
    "What if I cut shopping by 20%?", "Help me decide where to save", "Why am I spending more?", "Is a monthly grocery membership worth $10?",
  ])("never classifies advisory input as an explicit change: %s", q => { expect(explicitChangeRequest(q)).toBe(false); });
  it.each(["Add $60 to Coffee", "Please move $200 into Travel", "Can you withdraw $25 from Travel", "i will put more money into coffee than christmas gifts. help me add $60 to coffee"])("preserves explicit action requests: %s", q => { expect(explicitChangeRequest(q)).toBe(true); });
});
describe("composable evidence and what-if calculations", () => {
  it("composes drivers, ranking and a percentage reduction without mutating anything", () => {
    const state = fixture(), before = structuredClone(state);
    const result = runAnalysis(state, plan(analysisStep("COMPARE", { categories: ["Shopping"] }), analysisStep("SPENDING", { categories: ["Shopping"] }), analysisStep("REDUCE", { categories: ["Shopping"], percent: "20" })), "What changed in Shopping and what if I reduced it 20%?");
    expect(result.answer).toContain("Largest category changes"); expect(result.answer).toContain("average purchase"); expect(result.answer).toContain("20%");
    expect(result.answer).toContain("hypothetical"); expect(state).toEqual(before);
  });
  it("asks for terms for ANY selected merchant rather than assuming subscriptions cover everything", () => {
    const state = fixture();
    const result = runAnalysis(state, plan(analysisStep("ALTERNATIVE", { merchants: ["Luckin Coffee"], amount: "50" })), "Should I get a monthly $50 subscription at Luckin?");
    expect(result.pending).toBe(true); expect(result.answer).toContain("quota"); expect(result.answer).toContain("Luckin Coffee");
    expect(result.answer).not.toContain("cannot change money");
  });
  it("compares a confirmed unlimited subscription using cents calculated from actual records", () => {
    const s = fixture(), step = analysisStep("ALTERNATIVE", { merchants: ["Luckin Coffee"], amount: "50", coverage: "ALL" });
    const r = runAnalysis(s, plan(step), "$50 monthly subscription\nAll purchases are covered, no extra charges");
    expect(r.pending).toBe(false); expect(r.answer).toContain("$50.00 per full month"); expect(r.answer).toContain("less");
    expect(r.answer).toContain("No purchase, subscription or money change");
  });
  it("supports quota and overage pricing, but first verifies purchases represent units", () => {
    const step = analysisStep("ALTERNATIVE", { merchants: ["Luckin Coffee"], amount: "50", coverage: "QUOTA", includedCount: 10, extraUnitPrice: "2" });
    const text = "$50 includes 10 drinks, $2 per extra drink";
    expect(runAnalysis(fixture(), plan(step), text).answer).toContain("one eligible unit");
    const confirmed = runAnalysis(fixture(), plan(step), `${text}\n${analysisConsents.consentUnits}`);
    expect(confirmed.pending).toBe(false); expect(confirmed.answer).not.toContain("$50.00 per full month");
  });
  it("compares membership fees plus discounted purchases, rather than treating the fee as the entire cost", () => {
    const r = runAnalysis(fixture(), plan(analysisStep("ALTERNATIVE", { categories: ["Groceries"], amount: "10", coverage: "DISCOUNT", percent: "20" })), "$10 monthly fee gives 20% off all eligible purchases");
    expect(r.pending).toBe(false); expect(r.answer).toContain("Under the terms you supplied"); expect(r.answer).not.toContain("cost about $10.00 per full month");
  });
  it("separates a cash-affordability check from a rate estimate", () => {
    const r = runAnalysis(fixture(), plan(analysisStep("AFFORDABILITY", { amount: "75" }), analysisStep("RATE", { categories: ["Dining"] })), "Could I afford another $75 a month if dining stays at this rate?");
    expect(r.answer).toContain("$475.00"); expect(r.answer).toContain("not proof you can sustain"); expect(r.answer).toContain("Dining");
  });
  it("fails closed on invented input amounts, unknown entities and missing rate coverage", () => {
    expect(() => runAnalysis(fixture(), plan(analysisStep("AFFORDABILITY", { amount: "750" })), "Can I afford $75?")).toThrow("not supplied");
    expect(() => runAnalysis(fixture(), plan(analysisStep("SPENDING", { merchants: ["Invented"] })), "spending?")).toThrow("cannot find");
    const s = fixture(); s.syncWindow = null;
    expect(runAnalysis(s, plan(analysisStep("RATE")), "spending rate?").answer).toContain("synced coverage");
  });
});
describe("read-only conversations", () => {
  it("remembers terms and scope, deduplicates replies, and never creates a money proposal", async () => {
    const repo = await setup(), before = await repo.read(owner);
    const p = plan(analysisStep("ALTERNATIVE", { merchants: ["Luckin Coffee"], amount: "50" }));
    const first = await answerAnalysis(repo, owner, "Should I get a $50 monthly Luckin subscription?", randomUUID(), null, fake(p), now);
    expect(first.status).toBe("CLARIFICATION");
    const requestId = randomUUID();
    const second = await answerAnalysis(repo, owner, analysisConsents.consentAll, requestId, first.analysisId!, null, now);
    expect(second.status).toBe("ANSWER"); expect(second.answer).toContain("$50.00 per full month");
    const replay = await answerAnalysis(repo, owner, analysisConsents.consentAll, requestId, first.analysisId!, null, now);
    expect(replay).toEqual(second);
    const after = await repo.read(owner);
    expect(after.buckets).toEqual(before.buckets); expect(after.account).toEqual(before.account);
    expect(after.proposedActions).toEqual([]); expect(after.futureScenarios).toEqual([]); expect(after.activity).toEqual(before.activity);
    expect(after.analysisThreads[0].messages).toHaveLength(2);
  });
  it("keeps threads owner scoped and expired replies cannot restart them", async () => {
    const repo = await setup(); await repo.initialize(fixture("other"));
    const first = await answerAnalysis(repo, owner, "spending?", randomUUID(), null, fake(plan(analysisStep("SPENDING"))), now);
    const other = await answerAnalysis(repo, "other", "and more?", randomUUID(), first.analysisId!, null, now);
    expect(other.answer).toContain("unavailable");
    const expired = await answerAnalysis(repo, owner, "and more?", randomUUID(), first.analysisId!, null, new Date(now.getTime() + 900000));
    expect(expired.answer).toContain("expired");
  });
  it("supports safe local analysis fallback when the model fails", async () => {
    const r = await planAnalysis(fixture(), "What if I cut Shopping by 20%?", [], null, { generate: async () => { throw new Error("offline"); } });
    expect(r.mode).toBe("Local fallback"); expect(r.plan.steps[0]).toMatchObject({ operation: "REDUCE", percent: "20" });
  });
});
