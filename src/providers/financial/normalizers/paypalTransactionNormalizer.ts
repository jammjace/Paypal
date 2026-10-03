import "server-only";
import type { Transaction } from "@/domain/models";
import { FinancialProviderError } from "../types";

/** Replace unknown with the APIMatic-documented response model in milestone 7.
 * Map vendor semantics here and validate with transactionSchema before returning.
 * Deliberately no guessed payload fields or money/status mappings.
 */
export function normalizePayPalTransaction(payload: unknown): Transaction {
  void payload;
  throw new FinancialProviderError("NOT_CONFIGURED", "Transaction normalization requires APIMatic-verified source models.");
}
