import type { Account, Transaction } from "@/domain/models";

/** One provider instance is bound to one authenticated user's account, server-side. */
export interface ProviderBinding { userId: string; accountId: string; connectionId: string }
export interface BalanceSnapshot { account: Account; asOf: string }
/** UTC half-open interval [from, to). Cursor is opaque and scoped to this query. */
export interface TransactionQuery { from: string; to: string; cursor?: string; limit?: number }
export interface TransactionPage { transactions: Transaction[]; nextCursor: string | null }
export type ProviderErrorCode = "NOT_CONFIGURED" | "UNSUPPORTED_CAPABILITY" | "UNAUTHORIZED" | "RATE_LIMITED" | "UNAVAILABLE" | "INVALID_DATA";
export class FinancialProviderError extends Error {
  constructor(public readonly code: ProviderErrorCode, message: string) { super(message); this.name = "FinancialProviderError"; }
}
