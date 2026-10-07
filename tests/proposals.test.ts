import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { resolve, sep, join } from "node:path";
import { randomUUID } from "node:crypto";
import { createDemoFixture } from "@/fixtures/demo";
import { workspaceFromSnapshot } from "@/domain/workspace";
import { SqlitePalRepository } from "@/repositories/SqlitePalRepository";
import { createProposal, resolveProposal, refreshProposals, moneyFingerprint, PROPOSAL_TTL_MS } from "@/services/proposals";
import { reallocationOptions } from "@/finance/reallocation";
import { balanceSummary } from "@/finance/allocations";
import { interpretAction } from "@/server/ai/actions";
import { askPal } from "@/server/ai/pal";
import type { ReallocationRequest } from "@/domain/proposals";
import type { StructuredInterpreter } from "@/server/ai/structured";
import type { MutablePalRepository } from "@/repositories/MutablePalRepository";
import { z } from "zod";

const userId = "proposal-owner", now = new Date("2026-10-07T12:00:00.000Z");
const fixture = (owner = userId) => workspaceFromSnapshot(createDemoFixture({ userId: owner, accountId: `a-${owner}`, connectionId: `c-${owner}` }, "2026-10-15T18:00:00.000Z"));
const request: ReallocationRequest = { destinationBucketId: "travel", sourceBucketId: null, funding: "AUTO", amountCents: 20000 };
const root = resolve(".local/tests"), dirs: string[] = [];
async function setup() {
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(join(root, "proposals-")); dirs.push(dir);
  const repo = new SqlitePalRepository(join(dir, "pal.sqlite"));
  await repo.initialize(fixture());
  return repo;
}
afterEach(() => { for (const dir of dirs.splice(0)) { if (!resolve(dir).startsWith(root + sep)) throw new Error("Unsafe cleanup"); rmSync(dir, { recursive: true, force: true }); } });
async function preview(repo: SqlitePalRepository, input = request, requestId = randomUUID()) {
  return createProposal(repo, userId, input, requestId, moneyFingerprint(await repo.read(userId)), now);
}
describe("savings scenarios", () => {
  it("offers distinct sources with exact impacts without changing budgets or source data", () => {
    const state = fixture(), before = structuredClone(state);
    const options = reallocationOptions(state.account.currentBalanceCents, state.buckets, request, userId);
    expect(options.map(o => o.id)).toEqual(["safe-to-spend", "goal-christmas", "goal-rent"]);
    expect(options[0].after).toEqual({ balanceCents: 243000, earmarkedCents: 208000, safeToSpendCents: 35000 });
    expect(options[1].after.safeToSpendCents).toBe(55000);
    expect(options[1].goals).toEqual(expect.arrayContaining([expect.objectContaining({ name: "Travel", previousAmountCents: 42000, newAmountCents: 62000 })]));
    expect(options.flatMap(o => o.changes).some(c => c.bucketId === "coffee")).toBe(false);
    expect(state).toEqual(before);
  });
  it("combines only affordable funding and never worsens an existing shortfall", () => {
    const state = fixture();
    const options = reallocationOptions(243000, state.buckets, { ...request, amountCents: 80000 }, userId);
    expect(options.find(o => o.id === "combined")?.changes).toEqual([{ bucketId: "christmas", deltaCents: -25000 }, { bucketId: "travel", deltaCents: 80000 }]);
    const shortfall = reallocationOptions(180000, state.buckets, request, userId);
    expect(shortfall.every(o => o.after.safeToSpendCents >= -8000)).toBe(true);
    expect(shortfall.some(o => o.id === "safe-to-spend")).toBe(false);
  });
  it.each([
    { ...request, destinationBucketId: "coffee" }, { ...request, funding: "GOAL", sourceBucketId: "coffee" },
    { ...request, amountCents: 0 }, { ...request, amountCents: 1.5 }, { ...request, amountCents: 99999999 },
    { ...request, funding: "GOAL", sourceBucketId: "travel" }, { ...request, destinationBucketId: "foreign" },
  ])("rejects invalid or unaffordable requests %j", input => {
    const state = fixture();
    expect(() => reallocationOptions(243000, state.buckets, input as ReallocationRequest, userId)).toThrow();
  });
  it("withdraws savings into Safe to Spend without changing the account balance", () => {
    const options = reallocationOptions(243000, fixture().buckets, { ...request, destinationBucketId: null, sourceBucketId: "travel", funding: "GOAL" }, userId);
    expect(options).toHaveLength(1);
    expect(options[0].after).toEqual({ balanceCents: 243000, earmarkedCents: 168000, safeToSpendCents: 75000 });
  });
});
describe("durable explicit approval", () => {
  it("persists preview without moving money; approval applies once and audits atomically", async () => {
    const repo = await setup(), before = await repo.read(userId);
    const proposal = await preview(repo);
    const reopened = new SqlitePalRepository(repo.filename);
    const pending = await reopened.read(userId);
    expect(pending.buckets).toEqual(before.buckets);
    expect(pending.activity).toEqual(before.activity);
    expect(pending.proposedActions[0].status).toBe("PENDING");
    const decision = { decision: "APPROVE", proposalId: proposal.id, optionId: "goal-christmas" };
    expect((await resolveProposal(reopened, userId, decision, now)).ok).toBe(true);
    const saved = await reopened.read(userId);
    expect(saved.buckets.find(b => b.id === "travel")?.allocatedAmountCents).toBe(62000);
    expect(saved.buckets.find(b => b.id === "christmas")?.allocatedAmountCents).toBe(6000);
    expect(saved.activity.slice(-2).map(e => e.deltaCents)).toEqual([-20000, 20000]);
    expect(saved.events.slice(-3).map(e => e.kind)).toEqual(["ALLOCATION", "ALLOCATION", "PROPOSAL"]);
    await resolveProposal(reopened, userId, decision, now);
    expect(await reopened.read(userId)).toEqual(saved);
    await expect(resolveProposal(reopened, userId, { ...decision, optionId: "safe-to-spend" }, now)).rejects.toThrow("already approved");
  });
  it("rejects without money changes and cannot subsequently approve", async () => {
    const repo = await setup(), before = await repo.read(userId), proposal = await preview(repo);
    await resolveProposal(repo, userId, { decision: "REJECT", proposalId: proposal.id }, now);
    const saved = await repo.read(userId);
    expect(saved.buckets).toEqual(before.buckets);
    expect(saved.proposedActions[0].status).toBe("REJECTED");
    await expect(resolveProposal(repo, userId, { decision: "APPROVE", proposalId: proposal.id, optionId: "safe-to-spend" }, now)).rejects.toThrow("rejected");
  });
  it("deduplicates request retries and rejects changed payloads under the same ID", async () => {
    const repo = await setup(), id = randomUUID(), first = await preview(repo, request, id);
    const state = await repo.read(userId);
    expect((await preview(repo, request, id)).id).toBe(first.id);
    expect(await repo.read(userId)).toEqual(state);
    await expect(preview(repo, { ...request, amountCents: 100 }, id)).rejects.toThrow("different preview");
  });
  it("allows only one of concurrent competing options", async () => {
    const repo = await setup(), proposal = await preview(repo);
    const results = await Promise.allSettled(["safe-to-spend", "goal-christmas"].map(optionId => resolveProposal(new SqlitePalRepository(repo.filename), userId, { decision: "APPROVE", proposalId: proposal.id, optionId }, now)));
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect((await repo.read(userId)).buckets.find(b => b.id === "travel")?.allocatedAmountCents).toBe(62000);
  });
  it("uses real elapsed time and expires exactly at the deadline", async () => {
    const repo = await setup(), proposal = await preview(repo), before = await repo.read(userId);
    const result = await resolveProposal(repo, userId, { decision: "APPROVE", proposalId: proposal.id, optionId: "safe-to-spend" }, new Date(now.getTime() + PROPOSAL_TTL_MS));
    expect(result.ok).toBe(false);
    expect((await repo.read(userId)).proposedActions[0].status).toBe("EXPIRED");
    expect((await repo.read(userId)).buckets).toEqual(before.buckets);
  });
  it.each(["balance", "goal", "snapshot", "archive"])("expires after a %s change without applying old impacts", async kind => {
    const repo = await setup(), proposal = await preview(repo);
    await repo.transact(userId, state => {
      if (kind === "balance") state.account.currentBalanceCents -= 100;
      if (kind === "goal") state.buckets.find(b => b.id === "travel")!.targetAmountCents += 100;
      if (kind === "snapshot") state.asOf = "2026-10-16T18:00:00.000Z";
      if (kind === "archive") { const b = state.buckets.find(b => b.id === "travel")!; b.status = "ARCHIVED"; b.allocatedAmountCents = 0; }
    });
    const before = await repo.read(userId);
    expect((await resolveProposal(repo, userId, { decision: "APPROVE", proposalId: proposal.id, optionId: "safe-to-spend" }, now)).ok).toBe(false);
    expect((await repo.read(userId)).buckets).toEqual(before.buckets);
  });
  it("does not expire a preview when another draft is created, but expires siblings after approval", async () => {
    const repo = await setup(), first = await preview(repo), second = await preview(repo);
    await resolveProposal(repo, userId, { decision: "APPROVE", proposalId: first.id, optionId: "safe-to-spend" }, now);
    const saved = await refreshProposals(repo, userId, now);
    expect(saved.proposedActions.find(p => p.id === second.id)?.status).toBe("EXPIRED");
    expect(balanceSummary(saved.account.currentBalanceCents, saved.buckets).safeToSpendCents).toBe(35000);
  });
  it("rejects foreign ownership, invented options and client-supplied amounts without writes", async () => {
    const repo = await setup(), proposal = await preview(repo);
    await repo.initialize(fixture("other"));
    const saved = await repo.read(userId);
    const decision = { decision: "APPROVE", proposalId: proposal.id, optionId: "safe-to-spend" };
    await expect(resolveProposal(repo, "other", decision, now)).rejects.toThrow("not found");
    await expect(resolveProposal(repo, userId, { ...decision, optionId: "invented" }, now)).rejects.toThrow("Choose an option");
    await expect(resolveProposal(repo, userId, { ...decision, amountCents: 1 }, now)).rejects.toThrow();
    expect(await repo.read(userId)).toEqual(saved);
  });
  it("recomputes stored impacts instead of trusting a modified preview", async () => {
    const repo = await setup(), proposal = await preview(repo);
    await repo.transact(userId, state => { state.proposedActions[0].reallocation!.options[0].after.safeToSpendCents = 999999; });
    expect((await resolveProposal(repo, userId, { decision: "APPROVE", proposalId: proposal.id, optionId: "safe-to-spend" }, now)).ok).toBe(false);
    expect((await repo.read(userId)).buckets).toEqual(fixture().buckets);
  });
  it("rejects a draft if finances change during interpretation", async () => {
    const repo = await setup(), fingerprint = moneyFingerprint(await repo.read(userId));
    await repo.transact(userId, state => { state.account.currentBalanceCents -= 100; });
    const saved = await repo.read(userId);
    await expect(createProposal(repo, userId, request, randomUUID(), fingerprint, now)).rejects.toThrow("changed while interpreting");
    expect(await repo.read(userId)).toEqual(saved);
  });
  it("rolls back money, status and audit together if the transaction fails", async () => {
    const repo = await setup(), proposal = await preview(repo), before = await repo.read(userId);
    const failing: MutablePalRepository = {
      read: owner => repo.read(owner),
      replaceFinancialSnapshot: (owner, snapshot) => repo.replaceFinancialSnapshot(owner, snapshot),
      transact: (owner, operation) => repo.transact(owner, state => { operation(state); throw new Error("Simulated commit failure"); }),
    };
    await expect(resolveProposal(failing, userId, { decision: "APPROVE", proposalId: proposal.id, optionId: "safe-to-spend" }, now)).rejects.toThrow("Simulated commit failure");
    expect(await repo.read(userId)).toEqual(before);
  });
});
describe("action interpretation is untrusted and read-only", () => {
  it.each(["Add $200 to Travel", "Move $200 into Travel"])("extracts %s without changing state", async question => {
    const state = fixture(), before = structuredClone(state);
    expect((await askPal(state, question, null)).actionDraft).toEqual(request);
    expect(state).toEqual(before);
  });
  it.each(["Add $200 to Coffee", "Add $200 to Unknown", "Add $200 to Travel every month", "Move all savings to Travel", "Add $200 to Travel and $50 to Christmas", "Add $-200 to Travel"])("refuses %s", async question => {
    expect(await interpretAction(fixture(), question, null)).toBeNull();
  });
  it("accepts grounded structured interpretation and rejects invented amounts/names", async () => {
    const fake = (value: unknown): StructuredInterpreter => ({ generate: async <T>(schema: z.ZodType<T>) => schema.parse(value) });
    const draft = { supported: true, amount: "200", source: null, destination: "Travel", funding: "AUTO" };
    expect(await interpretAction(fixture(), "Could you set aside $200 for Travel?", fake(draft))).toEqual(request);
    expect(await interpretAction(fixture(), "Could you set aside $20 for Travel?", fake(draft))).toBeNull();
    expect(await interpretAction(fixture(), "Could you set aside $200 for Christmas?", fake(draft))).toBeNull();
  });
  it.each([
    ["Move $25 from Travel to Christmas", { destinationBucketId: "christmas", sourceBucketId: "travel", funding: "GOAL", amountCents: 2500 }],
    ["Withdraw $25 from Travel", { destinationBucketId: null, sourceBucketId: "travel", funding: "GOAL", amountCents: 2500 }],
    ["Move $25 from Safe to Spend to Travel", { destinationBucketId: "travel", sourceBucketId: null, funding: "SAFE_TO_SPEND", amountCents: 2500 }],
  ])("preserves explicit source in %s", async (question, expected) => {
    expect(await interpretAction(fixture(), question, null)).toEqual(expected);
  });
});
