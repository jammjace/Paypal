import { describe, expect, it } from "vitest";
import { createDemoFixture } from "@/fixtures/demo";
import { bucketProgress } from "@/finance/buckets";
import { balanceSummary, previewAllocation } from "@/finance/allocations";
import { migrateWorkspace } from "@/domain/migrations";
import { workspaceFromSnapshot, workspaceSchema } from "@/domain/workspace";

const fixture = createDemoFixture({ userId: "u", accountId: "a", connectionId: "c" }, "2026-10-15T18:00:00.000Z");
const coffee = fixture.buckets.find(b => b.id === "coffee")!;
describe("budgets and savings", () => {
  it("counts category spending without reserving the limit or deducting purchases twice", () => {
    expect(bucketProgress(coffee, fixture.transactions, fixture.asOf)).toMatchObject({ kind: "SPENDING", spentCents: 8460, remainingCents: 1540 });
    expect(balanceSummary(243000, fixture.buckets).safeToSpendCents).toBe(55000);
    expect(() => previewAllocation(243000, fixture.buckets, [{ bucketId: coffee.id, deltaCents: 100 }], "u")).toThrow("spending limit");
  });
  it("resets calendar periods, preserves overspend and excludes pending/reversed/transfers/refunds", () => {
    expect(bucketProgress({ ...coffee, targetAmountCents: 5000 }, fixture.transactions, fixture.asOf)).toMatchObject({ remainingCents: -3460, status: "OVER_BUDGET" });
    expect(bucketProgress(coffee, fixture.transactions, "2026-11-01T00:00:00.000Z")).toMatchObject({ spentCents: 0, remainingCents: 10000 });
    const tx = fixture.transactions.find(t => t.transactionDate.startsWith("2026-10") && t.category === "Coffee")!;
    const excluded = ["PENDING", "REVERSED"].map((status, i) => ({ ...tx, id: `excluded-${i}`, providerTransactionId: `excluded-${i}`, status: status as "PENDING" | "REVERSED" }));
    expect(bucketProgress(coffee, excluded, fixture.asOf)).toMatchObject({ spentCents: 0 });
    expect(bucketProgress(coffee, [{ ...tx, transactionType: "INTERNAL_TRANSFER" }, { ...tx, id: "refund", providerTransactionId: "refund", transactionType: "REFUND" }], fixture.asOf)).toMatchObject({ spentCents: 0 });
  });
  it("uses Monday UTC weeks and recalculates after corrections", () => {
    expect(bucketProgress({ ...coffee, budgetPeriod: "WEEKLY" }, fixture.transactions, fixture.asOf)).toMatchObject({ from: "2026-10-12T00:00:00.000Z", to: "2026-10-19T00:00:00.000Z", spentCents: 705 });
    const corrected = fixture.transactions.map(t => t.category === "Coffee" ? { ...t, category: "Dining" as const } : t);
    expect(bucketProgress(coffee, corrected, fixture.asOf)).toMatchObject({ spentCents: 0 });
  });
  it("keeps savings across periods and monthly plans separate from saved money", () => {
    const travel = fixture.buckets.find(b => b.id === "travel")!;
    expect(bucketProgress(travel, fixture.transactions, "2026-12-01T00:00:00.000Z")).toMatchObject({ kind: "GOAL", savedCents: 42000, monthlyContributionCents: 20000, remainingCents: 58000, reached: false });
    expect(bucketProgress({ ...travel, targetAmountCents: 0 }, [], fixture.asOf)).toMatchObject({ reached: false });
  });
  it("migrates legacy earmarks once, retaining savings and a release audit", () => {
    const legacy = { ...workspaceFromSnapshot(fixture), schemaVersion: 1, buckets: fixture.buckets.map(b => b.id === "coffee" ? { ...b, allocatedAmountCents: 6400 } : b.id === "rent" ? { ...b, type: "BILL" } : b) };
    const migrated = workspaceSchema.parse(migrateWorkspace(legacy));
    expect(migrated.buckets.find(b => b.id === "rent")).toMatchObject({ type: "GOAL", allocatedAmountCents: 120000 });
    expect(migrated.buckets.find(b => b.id === "coffee")?.allocatedAmountCents).toBe(0);
    expect(migrated.events.at(-1)?.deltaCents).toBe(-6400);
    expect(migrateWorkspace(migrated)).toEqual(migrated);
    expect(legacy.buckets.find(b => b.id === "coffee")?.allocatedAmountCents).toBe(6400);
  });
});
