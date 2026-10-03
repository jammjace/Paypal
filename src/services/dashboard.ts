import type { PalRepository } from "@/repositories/PalRepository";
import { balanceSummary, spendingSummary } from "@/finance/dashboard";

/** Provider-independent consumer; receives a repository, never an SDK client. */
export async function getDashboard(repository: PalRepository, userId: string) {
  const snapshot = await repository.read(userId);
  return {
    user: snapshot.user,
    currency: snapshot.account.currency,
    asOf: snapshot.asOf,
    balance: balanceSummary(snapshot.account.currentBalanceCents, snapshot.buckets),
    spending: spendingSummary(snapshot.transactions, snapshot.asOf),
    buckets: snapshot.buckets.filter(bucket => bucket.status === "ACTIVE"),
    reviewTransactions: snapshot.transactions.filter(tx => tx.needsReview && tx.status === "COMPLETED"),
    activity: snapshot.activity,
  };
}
export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;
