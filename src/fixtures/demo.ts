import type { Account, AllocationEvent, Bucket, PalSnapshot, Transaction, User } from "@/domain/models";
import type { ProviderBinding } from "@/providers/financial/types";

/** All invented data lives here, never in providers' consumers or the UI. */
export function createDemoFixture(binding: ProviderBinding, asOf: string): PalSnapshot {
  const anchor = new Date(asOf);
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth();
  const date = (offset: number, day: number) => new Date(Date.UTC(year, month + offset, day, 12)).toISOString();
  const user: User = { id: binding.userId, name: "Jamie", currency: "USD", createdAt: date(-2, 1) };
  const account: Account = { id: binding.accountId, userId: user.id, provider: "demo", providerAccountId: binding.connectionId, currency: "USD", currentBalanceCents: 243000, lastSyncedAt: asOf };
  const transactions: Transaction[] = [];
  const add = (offset: number, day: number, merchant: string, amount: number, category: Transaction["category"], extra: Partial<Transaction> = {}) => {
    const id = `transaction-${transactions.length + 1}`;
    transactions.push({ id, userId: user.id, accountId: account.id, providerTransactionId: `source-${id}`, rawDescription: merchant.toUpperCase(), normalizedMerchant: merchant,
      amountCents: amount, currency: "USD", direction: "OUT", transactionType: "PURCHASE", status: "COMPLETED", transactionDate: date(offset, day), category,
      categorizationConfidence: 0.98, categorizationSource: "RULE", needsReview: false, ...extra });
  };
  for (const offset of [-1, 0]) {
    const previous = offset === -1;
    for (let day = 1; day <= 12; day++) add(offset, day, "Luckin Coffee", previous ? 510 : 705, "Coffee", { rawDescription: "LUCKIN COFFEE BOSTON" });
    add(offset, 4, "SHEIN", previous ? 19340 : 13240, "Shopping", { rawDescription: "SHEIN US" });
    add(offset, 3, "Whole Foods", previous ? 14500 : 13200, "Groceries");
    add(offset, 11, "Whole Foods", previous ? 14903 : 13002, "Groceries");
    add(offset, 6, "Netflix", 1599, "Subscriptions", { rawDescription: "NETFLIX.COM" });
    add(offset, 9, "Uber", previous ? 5800 : 8000, "Transport");
    add(offset, 13, "Target", 7218, previous ? "Household" : "Uncategorized", previous ? {} : { categorizationConfidence: 0.42, categorizationSource: "UNCLASSIFIED", needsReview: true });
    add(offset, 8, "Neighborhood Kitchen", previous ? 19620 : 9481, "Dining");
    add(offset, 1, "Acme payroll", 240000, "Income", { direction: "IN", transactionType: "SALARY" });
    add(offset, 7, "Morgan", 3200, "Reimbursement", { direction: "IN", transactionType: "PEER_PAYMENT", categorizationSource: "USER" });
    add(offset, 10, "Savings account", 20000, "Transfer", { direction: "IN", transactionType: "INTERNAL_TRANSFER" });
  }
  add(-1, 22, "Whole Foods", 11980, "Groceries");
  add(-1, 28, "Acme payroll", 240000, "Income", { direction: "IN", transactionType: "SALARY" });
  add(0, 14, "Alex", 4820, "Uncategorized", { rawDescription: "ALEX", direction: "IN", transactionType: "PEER_PAYMENT", categorizationConfidence: 0.3, categorizationSource: "UNCLASSIFIED", needsReview: true });
  add(0, 12, "SHEIN", 1800, "Refund", { direction: "IN", transactionType: "REFUND" });
  const buckets: Bucket[] = [
    { id: "rent", name: "Rent", category: "Housing", type: "BILL", allocatedAmountCents: 120000, targetAmountCents: 120000, targetDate: date(1, 1), recurrence: "MONTHLY", priority: 1 },
    { id: "christmas", name: "Christmas", category: "Gifts", type: "GOAL", allocatedAmountCents: 26000, targetAmountCents: 40000, targetDate: date(2, 15), recurrence: null, priority: 3 },
    { id: "travel", name: "Travel", category: "Travel", type: "GOAL", allocatedAmountCents: 42000, targetAmountCents: 100000, targetDate: date(5, 1), recurrence: null, priority: 4 },
    { id: "coffee", name: "Coffee", category: "Coffee", type: "SPENDING", allocatedAmountCents: 6400, targetAmountCents: 10000, targetDate: date(1, 1), recurrence: "MONTHLY", priority: 5 },
  ].map(bucket => ({ ...bucket, userId: user.id, status: "ACTIVE" }) as Bucket);
  const activity: AllocationEvent[] = [
    { id: "event-1", userId: user.id, bucketId: "christmas", deltaCents: 15000, previousAmountCents: 11000, newAmountCents: 26000, reason: "Added to Christmas", createdAt: date(0, 14) },
    { id: "event-2", userId: user.id, bucketId: "travel", deltaCents: 12000, previousAmountCents: 30000, newAmountCents: 42000, reason: "Added to Travel", createdAt: date(0, 12) },
  ];
  return { user, account, buckets, transactions, activity: activity.filter(event => event.createdAt <= asOf), asOf };
}
