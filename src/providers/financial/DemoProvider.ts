import "server-only";
import type { FinancialProvider } from "./FinancialProvider";
import { FinancialProviderError, type BalanceSnapshot, type TransactionPage, type TransactionQuery } from "./types";
import { accountSchema, transactionSchema, timestampSchema } from "@/domain/models";
import type { Transaction } from "@/domain/models";

/** Accepts normalized fixtures; business logic has no awareness of this adapter. */
export class DemoProvider implements FinancialProvider {
  private readonly balance: BalanceSnapshot;
  private readonly transactions: Transaction[];
  constructor(balance: BalanceSnapshot, transactions: Transaction[]) {
    this.balance = { account: accountSchema.parse(balance.account), asOf: timestampSchema.parse(balance.asOf) };
    this.transactions = transactions.map(value => transactionSchema.parse(value));
    if (this.transactions.some(tx => tx.accountId !== this.balance.account.id || tx.userId !== this.balance.account.userId)) {
      throw new FinancialProviderError("INVALID_DATA", "Transactions do not belong to the bound account.");
    }
  }
  async getBalance(): Promise<BalanceSnapshot> { return structuredClone(this.balance); }
  async getTransactions(query: TransactionQuery): Promise<TransactionPage> {
    const from = timestampSchema.parse(query.from);
    const to = timestampSchema.parse(query.to);
    const offset = query.cursor === undefined ? 0 : Number(query.cursor);
    const limit = query.limit ?? 100;
    if (from >= to || !Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
      throw new FinancialProviderError("INVALID_DATA", "Invalid transaction query.");
    }
    const rows = this.transactions.filter(tx => tx.transactionDate >= from && tx.transactionDate < to)
      .sort((a, b) => a.transactionDate.localeCompare(b.transactionDate) || a.id.localeCompare(b.id));
    return { transactions: structuredClone(rows.slice(offset, offset + limit)), nextCursor: offset + limit < rows.length ? String(offset + limit) : null };
  }
}
