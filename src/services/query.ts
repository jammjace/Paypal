import { z } from "zod";
import type { PalSnapshot } from "@/domain/models";
import { balanceSummary } from "@/finance/allocations";
import { bucketProgress } from "@/finance/buckets";
import { compareSpending, incomeSummary, merchantAnalytics, spendingInPeriod } from "@/finance/analytics";
import { equivalentPeriods, resolvePeriod } from "@/finance/periods";
import { sumCents } from "@/finance/money";
import { money } from "@/lib/format";

export const querySchema = z.object({
  intent: z.enum(["BALANCE", "COMPARE_SPENDING", "MERCHANT", "CATEGORY", "TOP_MERCHANT", "INCOME", "BUCKET", "ACTION", "UNSUPPORTED"]),
  entity: z.string().nullable(), period: z.enum(["MONTH_TO_DATE", "PREVIOUS_MONTH"]),
}).strict();
export type FinancialQuery = z.infer<typeof querySchema>;
export type QueryContext = { buckets: string[]; merchants: string[]; categories: string[] };
const key = (s: string) => s.toLowerCase().trim();
export function queryContext(state: PalSnapshot): QueryContext {
  return { buckets: state.buckets.filter(b => b.status === "ACTIVE").map(b => b.name),
    merchants: [...new Set(state.transactions.map(tx => tx.normalizedMerchant))], categories: [...new Set(state.transactions.map(tx => tx.category))] };
}
/** Deliberately limited offline grammar. Unsupported input asks for clarification. */
export function parseLocalQuery(question: string, context: QueryContext): FinancialQuery {
  const q = key(question);
  const result = (intent: FinancialQuery["intent"], entity: string | null = null): FinancialQuery => ({ intent, entity, period: /last month|previous month/.test(q) && !/compar|more|less|so far|same/.test(q) ? "PREVIOUS_MONTH" : "MONTH_TO_DATE" });
  if (/\b(add|move|put|withdraw|allocate|transfer|delete|create)\b/.test(q)) return result("ACTION");
  if (/next|future|year|yesterday|today|week|\d{4}-\d{2}|january|february|march|april|may |june|july|august|september|october|november|december/.test(q)) return result("UNSUPPORTED");
  if (/compar|spent more|spent less|same.*last month/.test(q)) return result("COMPARE_SPENDING");
  if (/safe to spend|balance|earmark/.test(q)) return result("BALANCE");
  if (/income|reimburs|money received/.test(q)) return result("INCOME");
  if (/where.*(most|spend)|top merchant/.test(q)) return result("TOP_MERCHANT");
  const buckets = context.buckets.filter(name => q.includes(key(name)));
  if (buckets.length === 1 && /budget|left|remain|sav|goal|bucket/.test(q)) return result("BUCKET", buckets[0]);
  const merchants = context.merchants.filter(name => q.includes(key(name)) || (key(name).startsWith("luckin") && /\bluckin\b/.test(q)));
  if (merchants.length === 1 && /spen|paid|much/.test(q)) return result("MERCHANT", merchants[0]);
  const categories = context.categories.filter(name => q.includes(key(name)) || (name === "Dining" && /eating out|dining out/.test(q)));
  if (categories.length === 1 && /spen|much/.test(q)) return result("CATEGORY", categories[0]);
  return result("UNSUPPORTED");
}

/** All numbers and explanation text come from code, never model-generated arithmetic. */
export function answerQuery(state: PalSnapshot, input: unknown): string {
  const query = querySchema.parse(input);
  const transactions = state.transactions.filter(tx => tx.transactionDate <= state.asOf);
  const period = resolvePeriod({ mode: query.period }, state.asOf);
  const label = query.period === "PREVIOUS_MONTH" ? "last calendar month" : "this month to the snapshot date";
  switch (query.intent) {
    case "BALANCE": {
      if (query.period !== "MONTH_TO_DATE") return "Only the current balance snapshot is available; historical balances are not reconstructed from partial transactions.";
      const b = balanceSummary(state.account.currentBalanceCents, state.buckets);
      return `${money(b.balanceCents)} total balance − ${money(b.earmarkedCents)} saved in goals = ${money(b.safeToSpendCents)} Safe to Spend. Spending limits do not reserve cash. Monthly contribution plans are not deducted until you confirm an addition.`;
    }
    case "COMPARE_SPENDING": {
      const c = compareSpending(transactions, equivalentPeriods(state.asOf));
      return `Equivalent calendar days: ${money(c.currentCents)} this month versus ${money(c.previousCents)} last month. ${money(Math.abs(c.differenceCents))} ${c.differenceCents > 0 ? "more" : c.differenceCents < 0 ? "less" : "difference"}${c.percentChangeTenths === null ? " (no previous spending baseline)" : ` (${Math.abs(c.percentChangeTenths) / 10}%)`}.`;
    }
    case "BUCKET": {
      const buckets = state.buckets.filter(b => b.status === "ACTIVE" && key(b.name) === key(query.entity ?? ""));
      if (buckets.length !== 1) return "Please name one of your active buckets.";
      if (query.period !== "MONTH_TO_DATE") return "Bucket answers show the current saved balance or current budget period. Historical bucket snapshots are not available yet.";
      const b = buckets[0], progress = bucketProgress(b, transactions, state.asOf);
      if (progress.kind === "GOAL") return `${b.name}: ${money(progress.savedCents)} saved${b.targetAmountCents > 0 ? ` toward ${money(b.targetAmountCents)}; ${money(progress.remainingCents)} to go` : " (no total target)"}. Planned monthly addition: ${money(progress.monthlyContributionCents)}. Savings carry forward; additions require your confirmation.`;
      return `${b.name}: ${money(progress.spentCents)} spent of a ${money(b.targetAmountCents)} ${b.budgetPeriod === "WEEKLY" ? "weekly" : "monthly"} limit; ${money(Math.abs(progress.remainingCents))} ${progress.remainingCents < 0 ? "over budget" : "left to spend"}. This allowance is not reserved cash. Unclassified purchases can change the result after review.`;
    }
    case "MERCHANT": {
      const names = queryContext(state).merchants.filter(n => key(n) === key(query.entity ?? ""));
      if (names.length !== 1) return "Please name a merchant from your transactions.";
      const m = merchantAnalytics(transactions, names[0], { current: period, previous: equivalentPeriods(state.asOf).previous });
      return `${names[0]}: ${money(m.totalCents)} across ${m.count} completed purchases ${label}; ${money(m.averageCents ?? 0)} average.`;
    }
    case "CATEGORY": {
      if (!queryContext(state).categories.includes(query.entity ?? "")) return "Please choose a category from your transactions.";
      const amount = sumCents(spendingInPeriod(transactions, period).filter(t => t.category === query.entity).map(t => t.amountCents));
      return `${query.entity}: ${money(amount)} spent ${label}.`;
    }
    case "TOP_MERCHANT": {
      const m = compareSpending(transactions, { current: period, previous: period }).merchants[0];
      return m ? `${m.name} is your largest merchant ${label}: ${money(m.totalCents)} across ${m.count} purchases.` : `No completed spending recorded ${label}.`;
    }
    case "INCOME": {
      const i = incomeSummary(transactions, period);
      return `${label}: ${money(i.incomeCents)} income, ${money(i.reimbursementCents)} reimbursements, ${money(i.transferCents)} transfers, ${money(i.refundCents)} refunds, ${money(i.giftCents)} gifts and ${money(i.unresolvedCents)} awaiting classification. Saved balances cannot be attributed to a specific month's income.`;
    }
    case "ACTION": return "I cannot change money through Ask Pal yet. Open a savings goal to preview and confirm an addition or withdrawal. AI action proposals arrive in Milestone 5.";
    default: return "I can explain Safe to Spend, compare this month with the same days last month, show merchant/category spending or income for this or last month, and check a current budget or savings goal. Please ask one of these questions with a specific name.";
  }
}
