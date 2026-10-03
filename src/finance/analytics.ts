import { transactionSchema, type Category, type Transaction } from "@/domain/models";
import { averageCents, percentageTenths, subtractCents, sumCents } from "./money";
import { validatePeriod, type ComparisonPeriods, type Period } from "./periods";

const textOrder = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const displayName = (name: string) => name.trim().replace(/\s+/g, " ");
const merchantKey = (name: string) => displayName(name).toLowerCase();

function validateTransactions(transactions: readonly Transaction[]): Transaction[] {
  const ids = new Set<string>();
  const sourceIds = new Set<string>();
  let owner: string | undefined;
  return transactions.map(value => {
    const tx = transactionSchema.parse(value);
    const sourceKey = JSON.stringify([tx.accountId, tx.providerTransactionId]);
    if (ids.has(tx.id) || sourceIds.has(sourceKey)) throw new Error("Duplicate transaction in analytics input.");
    if (owner !== undefined && tx.userId !== owner) throw new Error("Analytics must be scoped to one owner.");
    if (!displayName(tx.normalizedMerchant)) throw new Error("Merchant name is empty.");
    owner = tx.userId;
    ids.add(tx.id);
    sourceIds.add(sourceKey);
    return tx;
  });
}
const inPeriod = (tx: Transaction, period: Period) => tx.transactionDate >= period.from && tx.transactionDate < period.to;
const isTransfer = (tx: Transaction) => tx.transactionType === "INTERNAL_TRANSFER" || tx.category === "Transfer";
const isRefund = (tx: Transaction) => tx.transactionType === "REFUND" || tx.category === "Refund";
const isSpending = (tx: Transaction) => tx.status === "COMPLETED" && tx.direction === "OUT" && !isTransfer(tx) && !isRefund(tx);
const total = (rows: Transaction[]) => sumCents(rows.map(tx => tx.amountCents));
function change(currentCents: number, previousCents: number) {
  const differenceCents = subtractCents(currentCents, previousCents);
  return { currentCents, previousCents, differenceCents, percentChangeTenths: percentageTenths(differenceCents, previousCents) };
}
export function spendingInPeriod(transactions: readonly Transaction[], input: Period) {
  const period = validatePeriod(input);
  return validateTransactions(transactions).filter(tx => isSpending(tx) && inPeriod(tx, period));
}
function categoryTotals(rows: Transaction[]) {
  const totals = new Map<Category, number[]>();
  for (const tx of rows) {
    const amounts = totals.get(tx.category) ?? [];
    amounts.push(tx.amountCents);
    totals.set(tx.category, amounts);
  }
  return new Map([...totals].map(([category, amounts]) => [category, sumCents(amounts)]));
}
function merchantResult(current: Transaction[], previous: Transaction[], key: string, name: string, categories: Map<Category, number>, currentTotal: number) {
  const rows = current.filter(tx => merchantKey(tx.normalizedMerchant) === key);
  const previousRows = previous.filter(tx => merchantKey(tx.normalizedMerchant) === key);
  const totalCents = total(rows);
  const parts = [...categoryTotals(rows)].map(([category, amount]) => ({
    category, totalCents: amount,
    shareOfCategoryTenths: percentageTenths(amount, categories.get(category) ?? 0),
    shareOfMerchantTenths: percentageTenths(amount, totalCents),
  })).sort((a, b) => b.totalCents - a.totalCents || textOrder(a.category, b.category));
  return {
    name, category: parts.length === 1 ? parts[0].category : parts.length > 1 ? "Multiple categories" : "No spending",
    count: rows.length, totalCents, averageCents: averageCents(rows.map(tx => tx.amountCents)),
    ...change(totalCents, total(previousRows)),
    shareTenths: percentageTenths(totalCents, currentTotal), categoryShares: parts,
  };
}
function periodRows(transactions: readonly Transaction[], inputs: ComparisonPeriods) {
  const periods = { current: validatePeriod(inputs.current), previous: validatePeriod(inputs.previous) };
  const rows = validateTransactions(transactions).filter(isSpending);
  return { periods, current: rows.filter(tx => inPeriod(tx, periods.current)), previous: rows.filter(tx => inPeriod(tx, periods.previous)) };
}
export function compareSpending(transactions: readonly Transaction[], inputs: ComparisonPeriods) {
  const { periods, current, previous } = periodRows(transactions, inputs);
  const currentCents = total(current), previousCents = total(previous);
  const currentCategories = categoryTotals(current), previousCategories = categoryTotals(previous);
  const categoryChanges = [...new Set([...currentCategories.keys(), ...previousCategories.keys()])]
    .map(category => ({ category, ...change(currentCategories.get(category) ?? 0, previousCategories.get(category) ?? 0) }))
    .sort((a, b) => Math.abs(b.differenceCents) - Math.abs(a.differenceCents) || textOrder(a.category, b.category));
  const categories = [...currentCategories].map(([category, totalCents]) => ({ category, totalCents, shareTenths: percentageTenths(totalCents, currentCents) }))
    .sort((a, b) => b.totalCents - a.totalCents || textOrder(a.category, b.category));
  const names = new Map<string, string>();
  // Stable labels independent of provider order/page boundaries.
  for (const tx of [...current, ...previous]) {
    const name = displayName(tx.normalizedMerchant), key = merchantKey(name);
    if (!names.has(key) || textOrder(name, names.get(key)!) < 0) names.set(key, name);
  }
  const merchants = [...names].map(([key, name]) => merchantResult(current, previous, key, name, currentCategories, currentCents))
    .sort((a, b) => b.totalCents - a.totalCents || textOrder(a.name, b.name));
  return { periods, ...change(currentCents, previousCents), categoryChanges, categories, merchants };
}
export function merchantAnalytics(transactions: readonly Transaction[], name: string, inputs: ComparisonPeriods) {
  const key = merchantKey(name);
  if (!key) throw new Error("Merchant name is empty.");
  const result = compareSpending(transactions, inputs);
  return result.merchants.find(merchant => merchantKey(merchant.name) === key)
    ?? merchantResult([], [], key, displayName(name), new Map(), result.currentCents);
}
export function incomeSummary(transactions: readonly Transaction[], input: Period) {
  const period = validatePeriod(input);
  const rows = validateTransactions(transactions).filter(tx => tx.status === "COMPLETED" && tx.direction === "IN" && inPeriod(tx, period));
  const amounts = { salaryCents: [] as number[], otherIncomeCents: [] as number[], reimbursementCents: [] as number[],
    transferCents: [] as number[], refundCents: [] as number[], giftCents: [] as number[], otherReceivedCents: [] as number[], unresolvedCents: [] as number[] };
  for (const tx of rows) {
    // Strong transfer/refund semantics win over an erroneous Income category.
    if (isTransfer(tx)) amounts.transferCents.push(tx.amountCents);
    else if (isRefund(tx)) amounts.refundCents.push(tx.amountCents);
    else if (tx.needsReview) amounts.unresolvedCents.push(tx.amountCents);
    else if (tx.category === "Reimbursement") amounts.reimbursementCents.push(tx.amountCents);
    else if (tx.category === "Gift") amounts.giftCents.push(tx.amountCents);
    else if (tx.category === "Income") amounts[tx.transactionType === "SALARY" ? "salaryCents" : "otherIncomeCents"].push(tx.amountCents);
    else if (tx.category === "Other") amounts.otherReceivedCents.push(tx.amountCents);
    else amounts.unresolvedCents.push(tx.amountCents);
  }
  const totals = {
    salaryCents: sumCents(amounts.salaryCents), otherIncomeCents: sumCents(amounts.otherIncomeCents),
    reimbursementCents: sumCents(amounts.reimbursementCents), transferCents: sumCents(amounts.transferCents),
    refundCents: sumCents(amounts.refundCents), giftCents: sumCents(amounts.giftCents), otherReceivedCents: sumCents(amounts.otherReceivedCents), unresolvedCents: sumCents(amounts.unresolvedCents),
  };
  return { totalReceivedCents: total(rows), incomeCents: sumCents([totals.salaryCents, totals.otherIncomeCents]), ...totals };
}
