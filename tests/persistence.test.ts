import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { resolve, sep, join } from "node:path";
import { randomUUID } from "node:crypto";
import { createDemoFixture } from "@/fixtures/demo";
import { workspaceFromSnapshot } from "@/domain/workspace";
import { SqlitePalRepository } from "@/repositories/SqlitePalRepository";
import { executeCommand, type PalCommand } from "@/services/commands";
import { classifyWithRules } from "@/services/classification";
import { LocalSessionStore } from "@/server/sessions";
import { openDatabase } from "@/server/database";
import { getDashboard } from "@/services/dashboard";
import { parseMoneyInput } from "@/lib/money-input";
import { syncFinancialData } from "@/server/syncFinancialData";

const root = resolve(".local/tests");
const dirs: string[] = [];
const userId = "test-owner";
const fixture = () => createDemoFixture({ userId, accountId: "account-1", connectionId: "source-1" }, "2026-10-15T18:00:00.000Z");
async function setup() {
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(join(root, "persistence-")); dirs.push(dir);
  const repo = new SqlitePalRepository(join(dir, "pal.sqlite"));
  await repo.initialize(workspaceFromSnapshot(fixture()));
  return repo;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) {
    if (!resolve(dir).startsWith(root + sep)) throw new Error("Unsafe test cleanup path.");
    rmSync(dir, { recursive: true, force: true });
  }
});
async function command(repo: SqlitePalRepository, command: PalCommand) {
  const state = await repo.read(userId);
  return executeCommand(repo, userId, { command, revision: state.revision, requestId: randomUUID() });
}
const newBucket = { bucketType: "GOAL" as const, name: "Emergency", category: "Savings", targetAmountCents: 50000, targetDate: null, recurrence: null, priority: 2, initialAmountCents: 5000 };

describe("durable workspace and mutations", () => {
  it("creates, edits and archives a bucket while retaining its history and releasing earmarks", async () => {
    const repo = await setup();
    await command(repo, { type: "CREATE_BUCKET", ...newBucket });
    const created = (await repo.read(userId)).buckets.find(b => b.name === "Emergency")!;
    expect(created).toMatchObject({ type: "GOAL", allocatedAmountCents: 5000 });
    expect((await getDashboard(repo, userId)).balance.safeToSpendCents).toBe(50000);
    await command(repo, { type: "EDIT_BUCKET", bucketId: created.id, bucketType: "GOAL", name: "Rainy day", category: "Savings", targetAmountCents: 60000, targetDate: null, recurrence: "MONTHLY", priority: 1 });
    await command(repo, { type: "ARCHIVE_BUCKET", bucketId: created.id });
    const saved = await repo.read(userId);
    expect(saved.buckets.find(b => b.id === created.id)).toMatchObject({ status: "ARCHIVED", allocatedAmountCents: 0, name: "Rainy day" });
    expect((await getDashboard(repo, userId)).balance.safeToSpendCents).toBe(55000);
    expect(saved.events.filter(e => e.bucketId === created.id).map(e => e.kind)).toEqual(["BUCKET_CREATED", "ALLOCATION", "BUCKET_EDITED", "ALLOCATION", "BUCKET_ARCHIVED"]);
  });
  it("persists budget limits without reserving cash and rejects duplicate category budgets", async () => {
    const repo = await setup();
    const budget = { ...newBucket, name: "Eating out", category: "Dining", bucketType: "SPENDING" as const, budgetPeriod: "MONTHLY" as const, initialAmountCents: 0, targetAmountCents: 30000 };
    await command(repo, { type: "CREATE_BUCKET", ...budget });
    const saved = await new SqlitePalRepository(repo.filename).read(userId);
    expect(saved.buckets.find(b => b.name === "Eating out")).toMatchObject({ allocatedAmountCents: 0, targetAmountCents: 30000, budgetPeriod: "MONTHLY" });
    expect((await getDashboard(repo, userId)).balance.safeToSpendCents).toBe(55000);
    await expect(command(repo, { type: "CREATE_BUCKET", ...budget, name: "Restaurants" })).rejects.toThrow("already has");
    await expect(command(repo, { type: "CREATE_BUCKET", ...budget, name: "Shopping", category: "Shopping", initialAmountCents: 100 })).rejects.toThrow("cannot hold savings");
    await expect(command(repo, { type: "EDIT_BUCKET", bucketId: "travel", bucketType: "SPENDING", name: "Travel", category: "Transport", targetAmountCents: 10000, targetDate: null, recurrence: null, priority: 4 })).rejects.toThrow("Archive");
    expect(await repo.read(userId)).toEqual(saved);
  });
  it("stores contribution plans without moving savings, and withdraws only on command", async () => {
    const repo = await setup();
    await command(repo, { type: "EDIT_BUCKET", bucketId: "travel", bucketType: "GOAL", name: "Travel", category: "Travel", targetAmountCents: 100000, monthlyContributionCents: 2500, targetDate: null, recurrence: null, priority: 4 });
    expect((await repo.read(userId)).buckets.find(b => b.id === "travel")).toMatchObject({ allocatedAmountCents: 42000, monthlyContributionCents: 2500 });
    await command(repo, { type: "ALLOCATE", fromBucketId: "travel", toBucketId: null, amountCents: 2500 });
    expect((await repo.read(userId)).buckets.find(b => b.id === "travel")?.allocatedAmountCents).toBe(39500);
    expect((await getDashboard(repo, userId)).balance.safeToSpendCents).toBe(57500);
  });
  it("persists Quick Check, rules and audit events across repository restarts", async () => {
    const repo = await setup();
    const alex = fixture().transactions.find(tx => tx.normalizedMerchant === "Alex")!;
    await command(repo, { type: "CLASSIFY", transactionId: alex.id, category: "Reimbursement", remember: true });
    const reopened = new SqlitePalRepository(repo.filename);
    const state = await reopened.read(userId);
    expect(state.transactions.find(tx => tx.id === alex.id)).toMatchObject({ category: "Reimbursement", needsReview: false, categorizationSource: "USER" });
    expect(state.merchantRules).toHaveLength(1);
    expect(state.events.at(-1)?.reason).toBe("Alex categorized as Reimbursement");
    expect((await getDashboard(reopened, userId)).income.reimbursementCents).toBe(8020);
  });
  it("atomically allocates, rejects insufficient funds and keeps the audit consistent", async () => {
    const repo = await setup();
    await command(repo, { type: "ALLOCATE", fromBucketId: "christmas", toBucketId: "travel", amountCents: 2000 });
    const state = await repo.read(userId);
    expect(state.buckets.find(b => b.id === "travel")?.allocatedAmountCents).toBe(44000);
    expect(state.buckets.find(b => b.id === "christmas")?.allocatedAmountCents).toBe(24000);
    expect(state.activity.slice(-2).map(event => event.deltaCents)).toEqual([-2000, 2000]);
    await expect(command(repo, { type: "ALLOCATE", fromBucketId: null, toBucketId: "travel", amountCents: 55001 })).rejects.toThrow();
    expect(await repo.read(userId)).toEqual(state);
  });
  it("does not leave an empty bucket or audit event when initial funding fails", async () => {
    const repo = await setup(), before = await repo.read(userId);
    await expect(command(repo, { type: "CREATE_BUCKET", ...newBucket, initialAmountCents: 55001 })).rejects.toThrow();
    expect(await repo.read(userId)).toEqual(before);
  });
  it("updates an existing remembered rule only when explicitly requested", async () => {
    const repo = await setup(), alex = fixture().transactions.find(tx => tx.normalizedMerchant === "Alex")!;
    await command(repo, { type: "CLASSIFY", transactionId: alex.id, category: "Reimbursement", remember: true });
    await command(repo, { type: "CLASSIFY", transactionId: alex.id, category: "Gift", remember: false });
    expect((await repo.read(userId)).merchantRules[0].category).toBe("Reimbursement");
    await command(repo, { type: "CLASSIFY", transactionId: alex.id, category: "Gift", remember: true });
    const rules = (await repo.read(userId)).merchantRules;
    expect(rules).toHaveLength(1);
    expect(rules[0].category).toBe("Gift");
  });
  it("makes repeated requests idempotent and rejects key reuse with different payloads", async () => {
    const repo = await setup();
    const request = { command: { type: "ALLOCATE", fromBucketId: null, toBucketId: "travel", amountCents: 1000 }, revision: 0, requestId: randomUUID() };
    const first = await executeCommand(repo, userId, request);
    const saved = await repo.read(userId);
    expect(await executeCommand(repo, userId, request)).toBe(first);
    expect(await repo.read(userId)).toEqual(saved);
    await expect(executeCommand(repo, userId, { ...request, command: { ...request.command, amountCents: 2000 } })).rejects.toThrow("different change");
  });
  it("allows only one of two competing revisions to commit", async () => {
    const repo = await setup();
    const other = new SqlitePalRepository(repo.filename);
    const results = await Promise.allSettled([repo, other].map(repository => executeCommand(repository, userId, {
      revision: 0, requestId: randomUUID(), command: { type: "ALLOCATE", fromBucketId: null, toBucketId: "travel", amountCents: 30000 },
    })));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect((await getDashboard(repo, userId)).balance.safeToSpendCents).toBe(25000);
  });
  it("rejects foreign resources and client-supplied identity", async () => {
    const repo = await setup();
    await expect(repo.read("foreign")).rejects.toThrow("not found");
    await expect(command(repo, { type: "EDIT_BUCKET", bucketId: "foreign-bucket", name: "Other", category: "Other", targetAmountCents: 0, targetDate: null, recurrence: null, priority: 1, bucketType: "GOAL" })).rejects.toThrow("not found");
    await expect(executeCommand(repo, userId, { revision: 0, requestId: randomUUID(), userId: "foreign", command: { type: "ARCHIVE_BUCKET", bucketId: "travel" } })).rejects.toThrow();
  });
  it("rolls back invalid workspace writes", async () => {
    const repo = await setup(), before = await repo.read(userId);
    await expect(repo.transact(userId, state => { state.account.userId = "other"; })).rejects.toThrow("ownership");
    expect(await repo.read(userId)).toEqual(before);
  });
});

describe("merge ingestion", () => {
  it("commits neither partial pages nor a checkpoint when a later provider page fails", async () => {
    const repo = await setup(), before = await repo.read(userId);
    await expect(syncFinancialData({
      getBalance: async () => ({ account: fixture().account, asOf: fixture().asOf }),
      getTransactions: async query => {
        if (query.cursor) throw new Error("Provider unavailable");
        return { transactions: [fixture().transactions[0]], nextCursor: "next" };
      },
    }, repo, userId)).rejects.toThrow("unavailable");
    expect(await repo.read(userId)).toEqual(before);
  });
  it("preserves corrections/history and applies remembered rules only to new matching records", async () => {
    const repo = await setup();
    const target = fixture().transactions.find(tx => tx.normalizedMerchant === "Target" && tx.needsReview)!;
    await command(repo, { type: "CLASSIFY", transactionId: target.id, category: "Shopping", remember: true });
    const next = { ...target, id: "new-target", providerTransactionId: "new-source", transactionDate: "2026-10-15T12:00:00.000Z" };
    const reversed = { ...fixture().transactions[0], id: "provider-changed-id", status: "REVERSED" as const };
    const financial = { account: fixture().account, asOf: fixture().asOf, transactions: [target, next, reversed] };
    await repo.replaceFinancialSnapshot(userId, financial);
    const saved = await repo.read(userId);
    expect(saved.transactions).toHaveLength(fixture().transactions.length + 1);
    expect(saved.transactions.find(tx => tx.id === target.id)).toMatchObject({ category: "Shopping", categorizationSource: "USER" });
    expect(saved.transactions.find(tx => tx.id === "new-target")).toMatchObject({ category: "Shopping", categorizationSource: "RULE", needsReview: false });
    expect(saved.transactions.find(tx => tx.id === fixture().transactions[0].id)?.status).toBe("REVERSED");
    await repo.replaceFinancialSnapshot(userId, financial);
    expect(await repo.read(userId)).toEqual(saved);
    const rule = saved.merchantRules[0];
    expect(classifyWithRules({ ...next, direction: "IN" }, [rule]).category).toBe("Uncategorized");
    expect(classifyWithRules({ ...next, transactionType: "PEER_PAYMENT" }, [rule]).category).toBe("Uncategorized");
  });
  it("rejects stale, duplicate and cross-account imports atomically", async () => {
    const repo = await setup(), before = await repo.read(userId);
    await expect(repo.replaceFinancialSnapshot(userId, { ...fixture(), asOf: "2026-10-14T18:00:00.000Z" })).rejects.toThrow("Stale");
    await expect(repo.replaceFinancialSnapshot(userId, { ...fixture(), transactions: [fixture().transactions[0], fixture().transactions[0]] })).rejects.toThrow();
    await expect(repo.replaceFinancialSnapshot(userId, { ...fixture(), transactions: [{ ...fixture().transactions[0], accountId: "foreign" }] })).rejects.toThrow();
    expect(await repo.read(userId)).toEqual(before);
  });
});

describe("sessions and money input", () => {
  it("stores token hashes, resolves across restarts and rejects forged/expired cookies", async () => {
    const repo = await setup(), sessions = new LocalSessionStore(repo.filename);
    const token = sessions.issue(userId);
    expect(new LocalSessionStore(repo.filename).resolve(token)).toBe(userId);
    expect(sessions.resolve("a".repeat(64))).toBeNull();
    const db = openDatabase(repo.filename);
    try {
      expect(db.prepare("SELECT token_hash FROM sessions").get()?.token_hash).not.toBe(token);
      db.prepare("UPDATE sessions SET expires_at = 0").run();
    } finally { db.close(); }
    expect(sessions.resolve(token)).toBeNull();
  });
  it("converts user decimal strings to exact cents", () => {
    expect(parseMoneyInput("10.25")).toBe(1025);
    expect(parseMoneyInput("0.01")).toBe(1);
    for (const value of ["1.001", "-1", "NaN", "1e3"]) expect(() => parseMoneyInput(value)).toThrow();
  });
});
