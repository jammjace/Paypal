import type { BalanceSnapshot, TransactionPage, TransactionQuery } from "./types";

/** Read-only financial boundary. No SDK response, auth token, or vendor event leaves it. */
export interface FinancialProvider {
  getBalance(): Promise<BalanceSnapshot>;
  getTransactions(query: TransactionQuery): Promise<TransactionPage>;
}

// Polling sync is orchestrated outside the provider. A future webhook adapter will
// verify vendor signatures internally and trigger this same normalized sync path.
// Do not promise subscriptions before a supported provider capability is verified.
