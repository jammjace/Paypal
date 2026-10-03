import "server-only";
import type { FinancialProvider } from "./FinancialProvider";
import { FinancialProviderError, type BalanceSnapshot, type ProviderBinding, type TransactionPage, type TransactionQuery } from "./types";

/** Intentional, fail-closed boundary. No API paths, SDK models, or auth assumptions. */
export class PayPalSandboxProvider implements FinancialProvider {
  constructor(readonly binding: ProviderBinding) {}
  async getBalance(): Promise<BalanceSnapshot> {
    throw new FinancialProviderError("NOT_CONFIGURED", "Sandbox integration awaits verified API context and account capabilities.");
  }
  async getTransactions(query: TransactionQuery): Promise<TransactionPage> {
    void query;
    throw new FinancialProviderError("NOT_CONFIGURED", "Sandbox integration awaits verified API context and account capabilities.");
  }
}
