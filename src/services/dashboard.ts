import type { PalRepository } from "@/repositories/PalRepository";
import { balanceSummary, spendingSummary } from "@/finance/dashboard";
import { incomeSummary } from "@/finance/analytics";
import { timestampSchema } from "@/domain/models";

/** Provider-independent consumer; receives a repository, never an SDK client. */
export async function getDashboard(repository: PalRepository, userId: string) {
  const snapshot = await repository.read(userId);
  const cutoff = timestampSchema.parse(snapshot.asOf);
  const transactions = snapshot.transactions.filter(tx => timestampSchema.parse(tx.transactionDate) <= cutoff);
  const spending = spendingSummary(transactions, cutoff);
  return {
    user: snapshot.user,
    currency: snapshot.account.currency,
    asOf: snapshot.asOf,
    balance: balanceSummary(snapshot.account.currentBalanceCents, snapshot.buckets),
    spending,
    income: incomeSummary(transactions, spending.periods.current),
    buckets: snapshot.buckets.filter(bucket => bucket.status === "ACTIVE"),
    reviewTransactions: transactions.filter(tx => tx.needsReview && tx.status === "COMPLETED"),
    activity: snapshot.activity,
  };
}
export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;
