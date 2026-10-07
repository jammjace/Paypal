import type { Transaction, Category } from "@/domain/models";
import type { MerchantRule } from "@/domain/workspace";

export const CONFIDENCE = { automatic: 0.9, review: 0.65 } as const;
export const merchantPattern = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();
export function classificationOptions(direction: Transaction["direction"]): Category[] {
  return direction === "IN" ? ["Reimbursement", "Gift", "Income", "Transfer", "Refund", "Other"]
    : ["Groceries", "Shopping", "Household", "Coffee", "Dining", "Subscriptions", "Transport", "Transfer", "Other"];
}
/** Exact merchant + direction + type, never a broad substring match. No AI in M3. */
export function classifyWithRules(transaction: Transaction, rules: MerchantRule[]): Transaction {
  if (transaction.categorizationSource === "USER") return { ...transaction };
  const rule = rules.find(rule => rule.userId === transaction.userId && rule.direction === transaction.direction
    && rule.transactionType === transaction.transactionType && rule.merchantPattern === merchantPattern(transaction.normalizedMerchant));
  if (rule) return { ...transaction, category: rule.category, normalizedMerchant: rule.normalizedMerchant,
    categorizationConfidence: rule.confidence, categorizationSource: "RULE", needsReview: rule.confidence < CONFIDENCE.review };
  return { ...transaction, needsReview: transaction.category === "Uncategorized" || transaction.categorizationConfidence < CONFIDENCE.review };
}
