import { timestampSchema, type Transaction } from "@/domain/models";
import { compareSpending } from "./analytics";
import { equivalentPeriods } from "./periods";

// Preserve milestone 1's imports; each concern is independently testable.
export { sumCents, percentageTenths } from "./money";
export { balanceSummary } from "./allocations";
export { equivalentPeriods } from "./periods";
export { spendingInPeriod } from "./analytics";

export function spendingSummary(transactions: readonly Transaction[], asOf: string) {
  const cutoff = timestampSchema.parse(asOf);
  const observed = transactions.filter(tx => timestampSchema.parse(tx.transactionDate) <= cutoff);
  return compareSpending(observed, equivalentPeriods(cutoff));
}
