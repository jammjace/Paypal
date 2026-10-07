import { bucketProgress } from "@/finance/buckets";
import type { PalRepository } from "@/repositories/PalRepository";
import { balanceSummary, spendingSummary } from "@/finance/dashboard";
import { incomeSummary } from "@/finance/analytics";
import { timestampSchema } from "@/domain/models";
import type { Workspace } from "@/domain/workspace";
import { pendingClarification } from "./copilot";

/** Provider-independent consumer; receives a repository, never an SDK client. */
export async function getDashboard(repository: PalRepository, userId: string) {
  const snapshot = await repository.read(userId);
  const cutoff = timestampSchema.parse(snapshot.asOf);
  const transactions = snapshot.transactions.filter(tx => timestampSchema.parse(tx.transactionDate) <= cutoff);
  const spending = spendingSummary(transactions, cutoff);
  return {
    user: snapshot.user,
    pendingClarification: "clarifications" in snapshot ? pendingClarification(snapshot as Workspace) : null,
    currency: snapshot.account.currency,
    asOf: snapshot.asOf,
    balance: balanceSummary(snapshot.account.currentBalanceCents, snapshot.buckets),
    spending,
    income: incomeSummary(transactions, spending.periods.current),
    buckets: snapshot.buckets.filter(bucket => bucket.status === "ACTIVE"),
    bucketProgress: Object.fromEntries(snapshot.buckets.map(b => [b.id, bucketProgress(b, transactions, cutoff)])),
    reviewTransactions: transactions.filter(tx => tx.needsReview && tx.status === "COMPLETED"),
    revision: "revision" in snapshot ? (snapshot as Workspace).revision : 0,
    activity: "events" in snapshot ? [...(snapshot as Workspace).events].reverse() : snapshot.activity.map(event => ({ ...event, kind: "ALLOCATION" as const, transactionId: null })),
  };
}
export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;
