import { describe, expect, it } from "vitest";
import { balanceSummary, equivalentPeriods, percentageTenths, spendingSummary, sumCents } from "@/finance/dashboard";
import { createDemoFixture } from "@/fixtures/demo";

const fixture = createDemoFixture({ userId: "u", accountId: "a", connectionId: "c" }, "2026-10-15T18:00:00.000Z");

describe("milestone 1 read-only calculation slice", () => {
  it("preserves negative Safe to Spend instead of silently clamping", () => {
    expect(balanceSummary(100, fixture.buckets).safeToSpendCents).toBe(-194300);
  });
  it("rounds ratios to tenths of one percent using integers and handles no baseline", () => {
    expect(percentageTenths(-14900, 89100)).toBe(-167);
    expect(percentageTenths(1, 3)).toBe(333);
    expect(percentageTenths(1, 0)).toBeNull();
  });
  it("clips equivalent days to the shorter month and crosses year boundaries", () => {
    expect(equivalentPeriods("2026-03-31T12:00:00.000Z").previous).toEqual({ from: "2026-02-01T00:00:00.000Z", to: "2026-03-01T00:00:00.000Z" });
    expect(equivalentPeriods("2028-03-31T12:00:00.000Z").previous.to).toBe("2028-03-01T00:00:00.000Z");
    expect(equivalentPeriods("2027-01-15T12:00:00.000Z").previous.from).toBe("2026-12-01T00:00:00.000Z");
  });
  it("does not count incoming reimbursements, refunds or internal transfers as spending", () => {
    const current = spendingSummary(fixture.transactions, fixture.asOf).currentCents;
    const transfer = { ...fixture.transactions[0], id: "transfer-out", transactionType: "INTERNAL_TRANSFER" as const, amountCents: 800000 };
    const pending = { ...fixture.transactions[0], id: "pending", status: "PENDING" as const, amountCents: 800000 };
    expect(spendingSummary([...fixture.transactions, transfer, pending], fixture.asOf).currentCents).toBe(current);
  });
  it("rejects unsafe sums and fractional inputs", () => {
    expect(() => sumCents([Number.MAX_SAFE_INTEGER, 1])).toThrow();
    expect(() => sumCents([1.5])).toThrow();
    expect(sumCents([10, -3, 5])).toBe(12);
  });
  it("returns empty aggregates without fabricated history", () => {
    expect(spendingSummary([], fixture.asOf)).toMatchObject({ currentCents: 0, previousCents: 0, percentChangeTenths: null, merchants: [] });
  });
});
