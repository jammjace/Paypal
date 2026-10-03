import type { Bucket, MoneyCents, Transaction } from "@/domain/models";

// Small read-only calculation slice needed by milestone 1. The broader finance
// engine (goals, simulations, recurring flows) remains milestone 2 and later.
export function sumCents(values: MoneyCents[]): MoneyCents {
  const sum = values.reduce((total, value) => {
    if (!Number.isSafeInteger(value)) throw new Error("Invalid integer cents.");
    return total + BigInt(value);
  }, 0n);
  const result = Number(sum);
  if (!Number.isSafeInteger(result)) throw new Error("Money exceeds supported range.");
  return result;
}
export function balanceSummary(balanceCents: MoneyCents, buckets: Bucket[]) {
  const earmarkedCents = sumCents(buckets.filter(bucket => bucket.status === "ACTIVE").map(bucket => bucket.allocatedAmountCents));
  return { balanceCents, earmarkedCents, safeToSpendCents: sumCents([balanceCents, -earmarkedCents]) };
}
export function percentageTenths(numerator: number, denominator: number): number | null {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator < 0) throw new Error("Invalid ratio.");
  if (denominator === 0) return null;
  const absolute = BigInt(Math.abs(numerator)) * 1000n;
  const rounded = (absolute + BigInt(denominator) / 2n) / BigInt(denominator);
  const result = Number(rounded) * Math.sign(numerator);
  if (!Number.isSafeInteger(result)) throw new Error("Ratio exceeds supported range.");
  return result;
}
export function equivalentPeriods(asOf: string) {
  const date = new Date(asOf);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid period anchor.");
  const year = date.getUTCFullYear(), month = date.getUTCMonth(), day = date.getUTCDate();
  const previousDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    current: { from: new Date(Date.UTC(year, month, 1)).toISOString(), to: new Date(Date.UTC(year, month, day + 1)).toISOString() },
    previous: { from: new Date(Date.UTC(year, month - 1, 1)).toISOString(), to: new Date(Date.UTC(year, month - 1, Math.min(day, previousDays) + 1)).toISOString() },
  };
}
export function spendingInPeriod(transactions: Transaction[], period: { from: string; to: string }) {
  return transactions.filter(tx => tx.status === "COMPLETED" && tx.direction === "OUT" && tx.transactionType !== "INTERNAL_TRANSFER" && tx.transactionType !== "REFUND" && tx.category !== "Transfer" && tx.transactionDate >= period.from && tx.transactionDate < period.to);
}
export function spendingSummary(transactions: Transaction[], asOf: string) {
  const periods = equivalentPeriods(asOf);
  const current = spendingInPeriod(transactions, periods.current);
  const previous = spendingInPeriod(transactions, periods.previous);
  const currentCents = sumCents(current.map(tx => tx.amountCents));
  const previousCents = sumCents(previous.map(tx => tx.amountCents));
  const differenceCents = sumCents([currentCents, -previousCents]);
  const merchants = [...new Set(current.map(tx => tx.normalizedMerchant))].map(name => {
    const rows = current.filter(tx => tx.normalizedMerchant === name);
    const totalCents = sumCents(rows.map(tx => tx.amountCents));
    return { name, category: rows[0].category, count: rows.length, totalCents, shareTenths: percentageTenths(totalCents, currentCents) };
  }).sort((a, b) => b.totalCents - a.totalCents || a.name.localeCompare(b.name));
  return { periods, currentCents, previousCents, differenceCents, percentChangeTenths: percentageTenths(differenceCents, previousCents), merchants };
}
