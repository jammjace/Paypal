import { accountSchema, timestampSchema, transactionSchema, type FinancialSnapshot } from "@/domain/models";
import type { Workspace } from "@/domain/workspace";
import { classifyWithRules } from "./classification";

/** Storage-independent merge; call only inside an atomic repository transaction. */
export function mergeFinancialSnapshot(state: Workspace, input: FinancialSnapshot, userId: string) {
  const account = accountSchema.parse(input.account), asOf = timestampSchema.parse(input.asOf);
  const incoming = input.transactions.map(tx => transactionSchema.parse(tx));
  if (account.userId !== userId || account.id !== state.account.id || account.provider !== state.account.provider || account.providerAccountId !== state.account.providerAccountId) throw new Error("Resource ownership mismatch.");
  if (asOf < state.asOf) throw new Error("Stale financial snapshot.");
  const ids = new Set<string>();
  const bySource = new Map(state.transactions.map(tx => [tx.providerTransactionId, tx]));
  for (const tx of incoming) {
    if (tx.userId !== userId || tx.accountId !== account.id || tx.currency !== account.currency || tx.transactionDate > asOf || ids.has(tx.providerTransactionId)) throw new Error("Invalid synced transaction.");
    ids.add(tx.providerTransactionId);
    const previous = bySource.get(tx.providerTransactionId);
    const next = previous ? { ...tx, id: previous.id, normalizedMerchant: previous.normalizedMerchant,
      category: previous.category, categorizationConfidence: previous.categorizationConfidence,
      categorizationSource: previous.categorizationSource, needsReview: previous.needsReview }
      : classifyWithRules(tx, state.merchantRules);
    bySource.set(tx.providerTransactionId, next);
  }
  state.transactions = [...bySource.values()];
  state.account = account;
  state.asOf = asOf;
  const end = new Date(asOf);
  state.syncWindow = { from: new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1)).toISOString(), to: new Date(end.getTime() + 1).toISOString() };
  // Missing rows are retained. Omission from a page/window is not deletion.
}
