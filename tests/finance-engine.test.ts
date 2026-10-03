import { describe, expect, it } from "vitest";
import type { Bucket, Transaction } from "@/domain/models";
import { addCents, subtractCents, averageCents, applyBasisPoints, percentageTenths, sumCents } from "@/finance/money";
import { equivalentPeriods, resolvePeriod } from "@/finance/periods";
import { compareSpending, incomeSummary, merchantAnalytics } from "@/finance/analytics";
import { balanceSummary, previewAllocation } from "@/finance/allocations";
import { projectGoal } from "@/finance/goals";

const asOf = "2026-10-15T18:00:00.000Z";
const periods = equivalentPeriods(asOf);
function tx(id: string, amountCents: number, patch: Partial<Transaction> = {}): Transaction {
  return { id, userId: "u", accountId: "a", providerTransactionId: id, rawDescription: "descriptor",
    normalizedMerchant: "Cafe", amountCents, currency: "USD", direction: "OUT", transactionType: "PURCHASE",
    status: "COMPLETED", transactionDate: "2026-10-05T12:00:00.000Z", category: "Coffee",
    categorizationConfidence: 1, categorizationSource: "USER", needsReview: false, ...patch };
}
function bucket(id: string, allocatedAmountCents: number, patch: Partial<Bucket> = {}): Bucket {
  return { id, userId: "u", name: id, category: "Travel", type: "GOAL", allocatedAmountCents,
    targetAmountCents: 10000, targetDate: "2026-12-01T12:00:00.000Z", recurrence: null, priority: 1, status: "ACTIVE", ...patch };
}

describe("integer money", () => {
  it("adds/subtracts exact cents and rounds halves away from zero", () => {
    expect(addCents(101, 202)).toBe(303);
    expect(subtractCents(101, 202)).toBe(-101);
    expect(averageCents([100, 101])).toBe(101);
    expect(averageCents([-100, -101])).toBe(-101);
    expect(averageCents([])).toBeNull();
    expect(applyBasisPoints(101, 5000)).toBe(51);
    expect(applyBasisPoints(-101, 5000)).toBe(-51);
    expect(percentageTenths(-1, 2000)).toBe(-1);
  });
  it("handles large integer intermediates without loss", () => {
    expect(applyBasisPoints(Number.MAX_SAFE_INTEGER, 10000)).toBe(Number.MAX_SAFE_INTEGER);
    expect(percentageTenths(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)).toBe(1000);
    expect(() => addCents(Number.MAX_SAFE_INTEGER, 1)).toThrow();
    expect(() => applyBasisPoints(100, 0.5)).toThrow();
    expect(() => sumCents([NaN])).toThrow();
  });
});

describe("period definitions", () => {
  it("uses exclusive end boundaries and includes leap day", () => {
    expect(equivalentPeriods("2028-03-31T18:00:00Z").previous).toEqual({ from: "2028-02-01T00:00:00.000Z", to: "2028-03-01T00:00:00.000Z" });
    expect(resolvePeriod({ mode: "PREVIOUS_MONTH" }, "2027-01-01T01:00:00Z")).toEqual({ from: "2026-12-01T00:00:00.000Z", to: "2027-01-01T00:00:00.000Z" });
    expect(resolvePeriod({ mode: "MONTH_TO_DATE" }, asOf)).toEqual(periods.current);
  });
  it("validates custom periods instead of accepting inverted or invalid dates", () => {
    expect(resolvePeriod({ mode: "CUSTOM", from: "2026-10-01T00:00:00Z", to: "2026-10-02T00:00:00Z" }, asOf).to).toBe("2026-10-02T00:00:00.000Z");
    expect(() => resolvePeriod({ mode: "CUSTOM", from: asOf, to: asOf }, asOf)).toThrow();
    expect(() => equivalentPeriods("2026-02-30T00:00:00Z")).toThrow();
  });
});

describe("spending and merchant analytics", () => {
  const rows = [tx("a", 100), tx("b", 201), tx("c", 99, { normalizedMerchant: "Other Cafe" }),
    tx("d", 500, { category: "Shopping" }),
    tx("old", 200, { transactionDate: "2026-09-05T12:00:00Z" }),
    tx("gone", 100, { normalizedMerchant: "Old shop", category: "Household", transactionDate: "2026-09-08T12:00:00Z" })];
  it("returns full merchant metrics and per-category shares without picking one arbitrary category", () => {
    const result = merchantAnalytics(rows, " cafe ", periods);
    expect(result).toMatchObject({ totalCents: 801, count: 3, averageCents: 267, previousCents: 200, differenceCents: 601, percentChangeTenths: 3005, shareTenths: 890, category: "Multiple categories" });
    expect(result.categoryShares).toEqual([
      { category: "Shopping", totalCents: 500, shareOfCategoryTenths: 1000, shareOfMerchantTenths: 624 },
      { category: "Coffee", totalCents: 301, shareOfCategoryTenths: 753, shareOfMerchantTenths: 376 },
    ]);
    expect(merchantAnalytics([...rows].reverse(), "Cafe", periods)).toEqual(result);
  });
  it("includes disappeared categories, category shares and deterministic rankings", () => {
    const result = compareSpending(rows, periods);
    expect(result).toMatchObject({ currentCents: 900, previousCents: 300, differenceCents: 600, percentChangeTenths: 2000 });
    expect(result.categoryChanges.find(item => item.category === "Household")).toMatchObject({ currentCents: 0, previousCents: 100, differenceCents: -100, percentChangeTenths: -1000 });
    expect(result.categories[0]).toMatchObject({ category: "Shopping", totalCents: 500, shareTenths: 556 });
    expect(result.merchants[0].name).toBe("Cafe");
  });
  it("reports no baseline and missing merchants without inventing percent changes", () => {
    expect(merchantAnalytics(rows, "Missing", periods)).toMatchObject({ totalCents: 0, count: 0, averageCents: null, previousCents: 0, percentChangeTenths: null });
    expect(merchantAnalytics(rows, "Old shop", periods)).toMatchObject({ totalCents: 0, previousCents: 100, percentChangeTenths: -1000 });
    expect(compareSpending([], periods).percentChangeTenths).toBeNull();
  });
  it("canonicalizes merchant case/whitespace but never fuzzy-merges unrelated merchants", () => {
    const result = compareSpending([tx("a", 100), tx("b", 100, { normalizedMerchant: " CAFE  " }), tx("c", 100, { normalizedMerchant: "Cafe West" })], periods);
    expect(result.merchants).toHaveLength(2);
    expect(result.merchants.find(item => item.count === 2)?.totalCents).toBe(200);
  });
  it("excludes reversed/pending/transfers/refunds and honors the exact date bounds", () => {
    const result = compareSpending([tx("ok", 100), tx("pending", 900, { status: "PENDING" }),
      tx("reversed", 900, { status: "REVERSED" }), tx("transfer", 900, { category: "Transfer" }),
      tx("refund", 900, { transactionType: "REFUND" }), tx("incoming", 900, { direction: "IN" }),
      tx("end", 900, { transactionDate: periods.current.to }), tx("start", 50, { transactionDate: periods.current.from })], periods);
    expect(result.currentCents).toBe(150);
  });
  it("rejects mixed ownership, duplicate records and unsupported currencies", () => {
    expect(() => compareSpending([tx("a", 100), tx("b", 100, { userId: "foreign" })], periods)).toThrow();
    expect(() => compareSpending([tx("a", 100), tx("a", 100)], periods)).toThrow();
    expect(() => compareSpending([tx("a", 100, { currency: "EUR" as "USD" })], periods)).toThrow();
  });
});

describe("incoming money", () => {
  it("separates salary, other income, reimbursement, transfers, gifts, refunds and unresolved money", () => {
    const incoming = (id: string, amount: number, patch: Partial<Transaction>) => tx(id, amount, { direction: "IN", transactionType: "PEER_PAYMENT", ...patch });
    const result = incomeSummary([
      incoming("salary", 100000, { category: "Income", transactionType: "SALARY" }),
      incoming("freelance", 10000, { category: "Income" }),
      incoming("reimbursement", 4820, { category: "Reimbursement" }),
      incoming("transfer", 20000, { category: "Income", transactionType: "INTERNAL_TRANSFER" }),
      incoming("transfer2", 1000, { category: "Transfer" }),
      incoming("refund", 1500, { category: "Income", transactionType: "REFUND" }),
      incoming("gift", 2000, { category: "Gift" }),
      incoming("other", 300, { category: "Other" }),
      incoming("unknown", 1200, { category: "Uncategorized", needsReview: true }),
      incoming("uncertain", 500, { category: "Income", needsReview: true }),
      incoming("pending", 999999, { category: "Income", status: "PENDING" }),
      tx("out", 999999, { category: "Income" }),
    ], periods.current);
    expect(result).toEqual({ totalReceivedCents: 141320, incomeCents: 110000, salaryCents: 100000, otherIncomeCents: 10000,
      reimbursementCents: 4820, transferCents: 21000, refundCents: 1500, giftCents: 2000, otherReceivedCents: 300, unresolvedCents: 1700 });
  });
});

describe("allocation invariants", () => {
  const buckets = [bucket("travel", 5000), bucket("coffee", 3000)];
  it("previews reallocation without changing balance, total earmarks or caller state", () => {
    const before = structuredClone(buckets);
    const result = previewAllocation(10000, buckets, [{ bucketId: "coffee", deltaCents: -2000 }, { bucketId: "travel", deltaCents: 2000 }], "u");
    expect(result.after).toEqual({ balanceCents: 10000, earmarkedCents: 8000, safeToSpendCents: 2000 });
    expect(result.buckets.find(item => item.id === "travel")?.allocatedAmountCents).toBe(7000);
    expect(buckets).toEqual(before);
  });
  it("previews adding/removing earmarks and rejects insufficient sources", () => {
    expect(previewAllocation(10000, buckets, [{ bucketId: "travel", deltaCents: 2000 }], "u").after.safeToSpendCents).toBe(0);
    expect(previewAllocation(10000, buckets, [{ bucketId: "travel", deltaCents: -1000 }], "u").after.safeToSpendCents).toBe(3000);
    expect(() => previewAllocation(10000, buckets, [{ bucketId: "travel", deltaCents: 2001 }], "u")).toThrow();
    expect(() => previewAllocation(10000, buckets, [{ bucketId: "coffee", deltaCents: -3001 }], "u")).toThrow();
  });
  it("allows reducing an existing shortfall, but never increasing it", () => {
    expect(balanceSummary(1000, buckets).safeToSpendCents).toBe(-7000);
    expect(previewAllocation(1000, buckets, [{ bucketId: "coffee", deltaCents: -1000 }], "u").after.safeToSpendCents).toBe(-6000);
    expect(() => previewAllocation(1000, buckets, [{ bucketId: "coffee", deltaCents: 1 }], "u")).toThrow();
  });
  it("is order-independent and preserves input state when a later validation fails", () => {
    const changes = [{ bucketId: "travel", deltaCents: 3000 }, { bucketId: "coffee", deltaCents: -3000 }];
    const first = previewAllocation(8000, buckets, changes, "u");
    const reversed = previewAllocation(8000, buckets, [...changes].reverse(), "u");
    expect(first.buckets).toEqual(reversed.buckets);
    expect(first.after).toEqual(reversed.after);
    const before = structuredClone(buckets);
    expect(() => previewAllocation(8000, buckets, [{ bucketId: "travel", deltaCents: 1000 }, { bucketId: "coffee", deltaCents: -4000 }], "u")).toThrow();
    expect(buckets).toEqual(before);
  });
  it("rejects duplicate, archived, foreign, fractional and missing bucket changes", () => {
    expect(() => previewAllocation(10000, buckets, [{ bucketId: "missing", deltaCents: 1 }], "u")).toThrow();
    expect(() => previewAllocation(10000, buckets, [{ bucketId: "coffee", deltaCents: 0.5 }], "u")).toThrow();
    expect(() => previewAllocation(10000, buckets, [{ bucketId: "coffee", deltaCents: 1 }, { bucketId: "coffee", deltaCents: 1 }], "u")).toThrow();
    expect(() => previewAllocation(10000, buckets, [{ bucketId: "coffee", deltaCents: 1 }], "other")).toThrow();
    expect(() => previewAllocation(10000, [bucket("old", 0, { status: "ARCHIVED" })], [{ bucketId: "old", deltaCents: 1 }], "u")).toThrow();
    expect(() => balanceSummary(10000, [bucket("bad", -1)])).toThrow();
    expect(() => balanceSummary(10000, [bucket("old", 100, { status: "ARCHIVED" })])).toThrow();
  });
});

describe("goal funding projections", () => {
  const input = { allocatedAmountCents: 0, targetAmountCents: 100, asOf: "2026-10-01T18:00:00Z", targetDate: "2026-10-22T12:00:00Z", contributionCents: 34, intervalDays: 7 };
  it("rounds funding requirements up so contributions meet the target", () => {
    expect(projectGoal(input)).toMatchObject({ remainingCents: 100, contributionOpportunities: 3, requiredPerContributionCents: 34, projectedCents: 102, shortfallCents: 0, status: "ON_TRACK", projectedFundedAt: "2026-10-22T00:00:00.000Z" });
  });
  it("reports shortfalls and no contributions rather than optimistic projections", () => {
    expect(projectGoal({ ...input, contributionCents: 30 })).toMatchObject({ projectedCents: 90, shortfallCents: 10, status: "SHORTFALL", projectedFundedAt: "2026-10-29T00:00:00.000Z" });
    expect(projectGoal({ ...input, contributionCents: 0 })).toMatchObject({ projectedCents: 0, projectedFundedAt: null, status: "SHORTFALL" });
  });
  it("handles funded, overdue and due-today goals without division by zero", () => {
    expect(projectGoal({ ...input, allocatedAmountCents: 120 })).toMatchObject({ remainingCents: 0, requiredPerContributionCents: 0, status: "FUNDED" });
    expect(projectGoal({ ...input, targetDate: "2026-09-30T00:00:00Z" })).toMatchObject({ contributionOpportunities: 0, requiredPerContributionCents: null, status: "OVERDUE" });
    expect(projectGoal({ ...input, targetDate: input.asOf })).toMatchObject({ contributionOpportunities: 0, requiredPerContributionCents: null, status: "SHORTFALL" });
    expect(() => projectGoal({ ...input, intervalDays: 0 })).toThrow();
    expect(() => projectGoal({ ...input, contributionCents: -1 })).toThrow();
  });
  it("rejects projected money overflow instead of returning rounded unsafe amounts", () => {
    expect(() => projectGoal({ ...input, allocatedAmountCents: 1, targetAmountCents: Number.MAX_SAFE_INTEGER, contributionCents: Number.MAX_SAFE_INTEGER })).toThrow();
  });
});
