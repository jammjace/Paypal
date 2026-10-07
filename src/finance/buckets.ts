import { timestampSchema, type Bucket, type Transaction } from "@/domain/models";
import { spendingInPeriod } from "./analytics";
import { sumCents, subtractCents } from "./money";
import { utcDate } from "./periods";

export function bucketProgress(bucket: Bucket, transactions: readonly Transaction[], asOf: string) {
  const date = new Date(timestampSchema.parse(asOf));
  if (bucket.type === "GOAL") return { kind: "GOAL" as const, savedCents: bucket.allocatedAmountCents,
    remainingCents: Math.max(0, subtractCents(bucket.targetAmountCents, bucket.allocatedAmountCents)),
    reached: bucket.targetAmountCents > 0 && bucket.allocatedAmountCents >= bucket.targetAmountCents,
    monthlyContributionCents: bucket.monthlyContributionCents ?? 0 };
  const weekly = bucket.budgetPeriod === "WEEKLY";
  const start = utcDate(date.getUTCFullYear(), date.getUTCMonth(), weekly ? date.getUTCDate() - (date.getUTCDay() + 6) % 7 : 1);
  const end = weekly ? new Date(start.getTime() + 7 * 86400000) : utcDate(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
  const rows = transactions.filter(tx => tx.transactionDate <= asOf);
  const spentCents = sumCents(spendingInPeriod(rows, { from: start.toISOString(), to: end.toISOString() })
    .filter(tx => tx.category === bucket.category).map(tx => tx.amountCents));
  const limitCents = bucket.limitOverride?.from === start.toISOString() && bucket.limitOverride.to === end.toISOString() ? bucket.limitOverride.amountCents : bucket.targetAmountCents;
  const remainingCents = subtractCents(limitCents, spentCents);
  return { kind: "SPENDING" as const, spentCents, remainingCents, limitCents, from: start.toISOString(), to: end.toISOString(),
    status: remainingCents < 0 ? "OVER_BUDGET" : remainingCents === 0 ? "LIMIT_REACHED" : "WITHIN_BUDGET" };
}
