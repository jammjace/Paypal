import { z } from "zod";

// USD is the MVP's only supported currency. Never silently convert other currencies.
export const currencySchema = z.literal("USD");
export const centsSchema = z.number().int().refine(Number.isSafeInteger, "Money must be safe integer cents");
export const timestampSchema = z.iso.datetime().transform(value => new Date(value).toISOString());
export const categorySchema = z.enum(["Coffee", "Dining", "Groceries", "Shopping", "Household", "Subscriptions", "Transport", "Income", "Reimbursement", "Gift", "Transfer", "Refund", "Other", "Uncategorized"]);
export const accountSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  // Opaque provenance for reconciliation only; never branch on this in finance/UI.
  provider: z.string().min(1),
  providerAccountId: z.string().min(1),
  currency: currencySchema,
  currentBalanceCents: centsSchema,
  lastSyncedAt: timestampSchema,
});
export const transactionSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  accountId: z.string().min(1),
  providerTransactionId: z.string().min(1),
  rawDescription: z.string(),
  normalizedMerchant: z.string().min(1),
  amountCents: centsSchema.refine(value => value >= 0, "Use direction for the sign"),
  currency: currencySchema,
  direction: z.enum(["IN", "OUT"]),
  transactionType: z.enum(["PURCHASE", "SALARY", "PEER_PAYMENT", "INTERNAL_TRANSFER", "REFUND", "FEE", "OTHER"]),
  status: z.enum(["PENDING", "COMPLETED", "REVERSED"]),
  transactionDate: timestampSchema,
  category: categorySchema,
  categorizationConfidence: z.number().min(0).max(1),
  categorizationSource: z.enum(["UNCLASSIFIED", "RULE", "AI", "USER"]),
  needsReview: z.boolean(),
});

export type MoneyCents = number;
export type Currency = z.infer<typeof currencySchema>;
export type Account = z.infer<typeof accountSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type Category = z.infer<typeof categorySchema>;
export interface User { id: string; name: string; currency: Currency; createdAt: string }
export interface Bucket {
  id: string; userId: string; name: string; category: string;
  type: "BILL" | "SPENDING" | "GOAL" | "FLEXIBLE";
  allocatedAmountCents: MoneyCents; targetAmountCents: MoneyCents;
  targetDate: string | null; recurrence: "MONTHLY" | null;
  priority: number; status: "ACTIVE" | "ARCHIVED";
}
export interface AllocationEvent {
  id: string; userId: string; bucketId: string; deltaCents: MoneyCents;
  previousAmountCents: MoneyCents; newAmountCents: MoneyCents;
  reason: string; createdAt: string;
}
export interface FinancialSnapshot { account: Account; transactions: Transaction[]; asOf: string }
export interface PalSnapshot extends FinancialSnapshot { user: User; buckets: Bucket[]; activity: AllocationEvent[] }
