import "server-only";
import { accountSchema, transactionSchema, timestampSchema } from "@/domain/models";
import type { FinancialProvider } from "@/providers/financial/FinancialProvider";
import { FinancialProviderError } from "@/providers/financial/types";
import type { PalRepository } from "@/repositories/PalRepository";

/** Only normalized data is accepted, even if a buggy adapter violates its TS types. */
export async function syncFinancialData(provider: FinancialProvider, repository: PalRepository, userId: string) {
  const balance = await provider.getBalance();
  const account = accountSchema.parse(balance.account);
  const asOf = timestampSchema.parse(balance.asOf);
  if (account.userId !== userId) throw new FinancialProviderError("INVALID_DATA", "Resource ownership mismatch.");
  const end = new Date(asOf);
  const from = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1)).toISOString();
  const to = new Date(end.getTime() + 1).toISOString();
  const transactions = [];
  const ids = new Set<string>();
  const cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await provider.getTransactions({ from, to, cursor, limit: 100 });
    for (const value of page.transactions) {
      const tx = transactionSchema.parse(value);
      if (tx.userId !== userId || tx.accountId !== account.id || tx.currency !== account.currency || tx.transactionDate < from || tx.transactionDate >= to || ids.has(tx.providerTransactionId)) {
        throw new FinancialProviderError("INVALID_DATA", "Invalid, duplicate, or out-of-scope transaction.");
      }
      ids.add(tx.providerTransactionId);
      transactions.push(tx);
    }
    cursor = page.nextCursor ?? undefined;
    if (cursor !== undefined) {
      if (cursors.has(cursor) || cursors.size >= 1000) throw new FinancialProviderError("INVALID_DATA", "Invalid provider pagination.");
      cursors.add(cursor);
    }
  } while (cursor !== undefined);
  await repository.replaceFinancialSnapshot(userId, { account, transactions, asOf });
}
