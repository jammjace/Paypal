import type { Workspace } from "@/domain/workspace";
import { analysisPlanSchema, type AnalysisPlan } from "@/domain/analysis";
import { spendingInPeriod, compareSpending } from "./analytics";
import { resolvePeriod, equivalentPeriods } from "./periods";
import { sumCents, averageCents, roundedRatio, subtractCents, addCents } from "./money";
import { balanceSummary } from "./allocations";
import { projectFuture } from "./future";
import { answerQuery, queryContext } from "@/services/query";
import { parseMoneyInput } from "@/lib/money-input";
import { money } from "@/lib/format";

export type AnalysisResult = { answer: string; pending: boolean; choices: { value: string; label: string }[] };
const key = (s: string) => s.toLowerCase().trim();
const consentAll = "Assume all selected purchases are covered, with no extra charges";
const consentUnits = "Each recorded purchase is one eligible unit; compare using those terms";
export const analysisConsents = { consentAll, consentUnits };
export function moneyArgument(value: string | null, userText: string): number | null {
  if (value === null) return null;
  const amount = parseMoneyInput(value);
  const literals = [...userText.matchAll(/\d+(?:\.\d+)?/g)].map(m => { try { return parseMoneyInput(m[0]); } catch { return -1; } });
  if (!literals.includes(amount)) throw new Error("The amount was not supplied by you. Please state the amount explicitly.");
  return amount;
}

/** Executes only pure functions on an owner-scoped snapshot. No mutation capabilities. */
export function runAnalysis(state: Workspace, input: AnalysisPlan, userText: string): AnalysisResult {
  const plan = analysisPlanSchema.parse(input), paragraphs: string[] = [], questions: string[] = [];
  const choices: AnalysisResult["choices"] = [];
  const context = queryContext(state), validTransactions = state.transactions.filter(t => t.transactionDate <= state.asOf);
  for (const step of plan.steps) {
    for (const name of step.merchants) if (!context.merchants.some(n => key(n) === key(name))) throw new Error(`I cannot find ${name} in your stored merchants. Which merchant do you mean?`);
    for (const name of step.categories) if (!context.categories.some(n => key(n) === key(name))) throw new Error(`I cannot find the ${name} category in your stored data.`);
    const selected = validTransactions.filter(t => (!step.merchants.length || step.merchants.some(m => key(m) === key(t.normalizedMerchant))) && (!step.categories.length || step.categories.some(c => key(c) === key(t.category))));
    const scope = [...step.merchants, ...step.categories].join(" / ") || "All spending";
    const period = resolvePeriod({ mode: step.period }, state.asOf);
    const rows = spendingInPeriod(selected, period), total = sumCents(rows.map(t => t.amountCents));
    const periodLabel = step.period === "PREVIOUS_MONTH" ? "last calendar month" : "this month to the snapshot date";
    const amount = moneyArgument(step.amount, userText);
    const percentage = step.percent === null ? null : moneyArgument(step.percent, /\bhalf\b/i.test(userText) ? `${userText} 50` : userText);
    if (percentage !== null && percentage > 10000) throw new Error("Use a percentage between zero and one hundred.");
    if (step.operation === "BALANCE" || step.operation === "INCOME" || step.operation === "BUCKET") {
      paragraphs.push(answerQuery(state, { intent: step.operation, entity: step.bucket, period: step.period })); continue;
    }
    if (step.operation === "GOALS") {
      const goals = projectFuture(state).goals.filter(g => !step.bucket || key(g.name) === key(step.bucket));
      paragraphs.push(goals.map(g => `${g.name}: ${money(g.projectedCents)} projected savings over the rest of this month and the next twelve calendar months; ${g.fundedAt ? `target reached ${g.fundedAt.slice(0, 10)}` : "target not reached in this horizon"}.`).join(" ") + " This uses only saved event/contribution plans, not assumed income or everyday spending. Contributions are not automatic."); continue;
    }
    if (step.operation === "AFFORDABILITY") {
      const safe = balanceSummary(state.account.currentBalanceCents, state.buckets).safeToSpendCents;
      if (amount === null) { questions.push("What purchase or additional monthly cost should I check against your available money?"); continue; }
      paragraphs.push(`Current Safe to Spend is ${money(safe)}. A ${money(amount)} expense would leave ${money(subtractCents(safe, amount))}${amount > safe ? ", exceeding unreserved cash" : " in unreserved cash"}. That is a current cash check, not proof you can sustain a recurring expense; upcoming bills and income may change affordability. No money or budget has changed.`); continue;
    }
    if (step.operation === "SPENDING") {
      if (!rows.length) { paragraphs.push(`${scope}: no completed purchases recorded ${periodLabel}. Missing records do not prove zero actual spending.`); continue; }
      paragraphs.push(`${scope}: ${money(total)} across ${rows.length} completed purchases ${periodLabel}; ${money(averageCents(rows.map(t => t.amountCents)) ?? 0)} average purchase.`);
      const stats = compareSpending(selected, { current: period, previous: period });
      paragraphs.push(`Largest merchants: ${stats.merchants.slice(0, 5).map(m => `${m.name} ${money(m.totalCents)} (${m.count} purchases)`).join("; ")}. Review which purchases are flexible or valuable to you before deciding what to cut; merchant/category names alone do not establish necessity.`); continue;
    }
    if (step.operation === "COMPARE") {
      const periods = equivalentPeriods(state.asOf);
      const change = compareSpending(selected, periods);
      paragraphs.push(`${scope}, equivalent calendar days: ${money(change.currentCents)} this month versus ${money(change.previousCents)} last month; ${money(Math.abs(change.differenceCents))} ${change.differenceCents > 0 ? "more" : change.differenceCents < 0 ? "less" : "difference"}.`);
      const drivers = [...change.categoryChanges].sort((a, b) => Math.abs(b.differenceCents) - Math.abs(a.differenceCents)).slice(0, 4);
      paragraphs.push(`Largest category changes: ${drivers.map(c => `${c.category} ${c.differenceCents >= 0 ? "+" : "−"}${money(Math.abs(c.differenceCents))}`).join("; ") || "none"}.`);
      const prior = spendingInPeriod(selected, periods.previous), current = spendingInPeriod(selected, periods.current);
      paragraphs.push(`Purchase count: ${prior.length} → ${current.length}; average purchase: ${money(averageCents(prior.map(t => t.amountCents)) ?? 0)} → ${money(averageCents(current.map(t => t.amountCents)) ?? 0)}. These describe the change; receipts do not establish the personal reason for it.`); continue;
    }
    // Rate-based analyses require a complete observation interval, excluding a partial current day.
    const date = new Date(state.asOf), from = period.from;
    const to = step.period === "PREVIOUS_MONTH" ? period.to : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString();
    const days = (new Date(to).getTime() - new Date(from).getTime()) / 86400000;
    if (!days || !state.syncWindow || state.syncWindow.from > from || state.syncWindow.to < to) {
      paragraphs.push(`${scope}: I need synced coverage for a complete observation period before estimating a rate. Sync transactions or select another period; I will not treat missing data as zero.`); continue;
    }
    const observed = spendingInPeriod(selected, { from, to });
    if (!observed.length) { paragraphs.push(`${scope}: there are no completed purchases in the observed full days, so I cannot infer your usual rate.`); continue; }
    const monthDays = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    const spent = sumCents(observed.map(t => t.amountCents));
    const projected = roundedRatio(BigInt(spent) * BigInt(monthDays), BigInt(days));
    const projectedCount = roundedRatio(BigInt(observed.length) * BigInt(monthDays) * 100n, BigInt(days));
    paragraphs.push(`${scope}: ${money(spent)} across ${observed.length} purchases in ${days} completed UTC days (${from.slice(0, 10)} through ${new Date(new Date(to).getTime() - 1).toISOString().slice(0, 10)}). At the same daily rate, a ${monthDays}-day month projects to ${money(projected)} and about ${(projectedCount / 100).toFixed(2)} purchases.`);
    if (step.operation === "REDUCE") {
      if (amount === null && percentage === null) { questions.push("What reduction would you like to explore: a dollar amount per month or a percentage? This will only simulate it."); continue; }
      const savings = percentage === null ? amount! : roundedRatio(BigInt(projected) * BigInt(percentage), 10000n);
      if (savings > projected) paragraphs.push(`Saving ${money(savings)} exceeds this scope's projected ${money(projected)} monthly spend. You would need other sources or a smaller target.`);
      else paragraphs.push(`Reducing this scope by ${percentage === null ? money(savings) : `${percentage / 100}%`} would save about ${money(savings)} per month and leave ${money(subtractCents(projected, savings))} monthly spending, assuming unchanged usage/prices elsewhere. This is hypothetical; no allocation or limit changed.`);
    }
    if (step.operation === "ALTERNATIVE") {
      if (amount === null) { questions.push("What is the alternative's monthly fee, and what purchases or services does it include?"); continue; }
      const matchedMerchants = [...new Set(observed.map(t => t.normalizedMerchant))].join(", ");
      if (step.coverage === "UNKNOWN") {
        questions.push(`For ${matchedMerchants}, what does the ${money(amount)} monthly alternative cover: all purchases without extra charges, a quota with an extra unit price, or a percentage discount? Confirm that these merchants and purchases are eligible; I cannot verify a provider's terms from transaction names.${observed.some(t => t.category === "Transport") ? " Transport can include taxis." : ""} A receipt is a purchase, not necessarily one item.`);
        choices.push({ value: consentAll, label: "Assume all selected purchases are covered, with no extra charges" }); continue;
      }
      let alternative = amount;
      if (step.coverage === "ALL" && !/unlimited|all.*cover|cover.*all|no extra charges/i.test(userText)) {
        questions.push(`Please confirm the monthly fee covers all selected purchases at ${matchedMerchants} without extra charges.`);
        choices.push({ value: consentAll, label: consentAll }); continue;
      }
      if (step.coverage === "QUOTA") {
        if (step.includedCount === null || step.extraUnitPrice === null) { questions.push("How many eligible units are included each month, and what is the price for each extra unit?"); continue; }
        moneyArgument(String(step.includedCount), userText);
        const unitPrice = moneyArgument(step.extraUnitPrice, userText)!;
        if (!/one (?:eligible )?(?:unit|drink|item).*purchase|one.*transaction|each recorded purchase is one/i.test(userText)) {
          questions.push("Transactions count receipts rather than individual items. Does each recorded purchase represent one eligible unit? If not, I need actual unit counts.");
          choices.push({ value: consentUnits, label: consentUnits }); continue;
        }
        const excess = BigInt(observed.length) * BigInt(monthDays) - BigInt(step.includedCount) * BigInt(days);
        alternative = addCents(amount, roundedRatio((excess > 0n ? excess : 0n) * BigInt(unitPrice), BigInt(days)));
      }
      if (step.coverage === "DISCOUNT") {
        if (percentage === null) { questions.push("What percentage discount does the monthly fee provide, and does it apply to all selected purchases?"); continue; }
        if (!/all.*(cover|eligible|purchase)|apply.*all|all selected purchases/i.test(userText)) { questions.push("Does the discount apply to all selected purchases, without exclusions or extra charges?"); continue; }
        alternative = addCents(amount, subtractCents(projected, roundedRatio(BigInt(projected) * BigInt(percentage), 10000n)));
      }
      const saving = subtractCents(projected, alternative);
      paragraphs.push(`Under the terms you supplied, the alternative would cost about ${money(alternative)} per full month versus ${money(projected)} at the observed rate: ${saving > 0 ? `${money(saving)} less` : saving < 0 ? `${money(-saving)} more` : "the same cost"}. On cost alone, ${saving > 0 ? "the alternative is cheaper" : saving < 0 ? "your current pattern is cheaper" : "they break even"}. This assumes similar usage and eligible purchases; it is not a suggestion to increase consumption to justify a subscription. No purchase, subscription or money change was made.`);
    }
  }
  if (plan.clarification) questions.push(plan.clarification);
  if (!paragraphs.length && !questions.length) questions.push("What spending decision would you like to explore? Tell me the purchases, period, or trade-off involved so I can identify the needed data.");
  return { answer: [...paragraphs, ...new Set(questions)].join("\n\n"), pending: questions.length > 0, choices };
}
