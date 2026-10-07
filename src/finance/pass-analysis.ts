import type { Workspace } from "@/domain/workspace";
import { spendingInPeriod } from "./analytics";
import { assertNonnegative, roundedRatio, subtractCents, sumCents } from "./money";
import { money } from "@/lib/format";

export function compareMonthlyPass(state: Workspace, merchants: string[], priceCents: number) {
  assertNonnegative(priceCents);
  if (!priceCents || !merchants.length) throw new Error("Choose merchants and a positive pass price.");
  const date = new Date(state.asOf), from = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString();
  const to = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString();
  const days = date.getUTCDate() - 1, monthDays = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  if (!days || !state.syncWindow || state.syncWindow.from > from || state.syncWindow.to < to) {
    return "I cannot estimate a reliable monthly rate yet: I need synced coverage from the start of this month through at least one completed UTC day. Sync transactions and ask again. No comparison has been assumed from missing data.";
  }
  const rows = spendingInPeriod(state.transactions, { from, to }).filter(tx => tx.category === "Transport" && merchants.includes(tx.normalizedMerchant));
  if (!rows.length) return "No completed Transport purchases for the selected merchants were recorded in the completed days of this month. There is not enough observed usage to recommend a pass.";
  const spent = sumCents(rows.map(tx => tx.amountCents));
  const projected = roundedRatio(BigInt(spent) * BigInt(monthDays), BigInt(days));
  const difference = subtractCents(projected, priceCents);
  return `${merchants.join(", ")}: ${money(spent)} across ${rows.length} purchases in ${days} completed UTC days (${from.slice(0, 10)} through ${new Date(new Date(to).getTime() - 1).toISOString().slice(0, 10)}). At that daily rate, ${monthDays} days would cost about ${money(projected)}. A ${money(priceCents)} monthly pass would ${difference > 0 ? `save about ${money(difference)}` : difference < 0 ? `cost about ${money(-difference)} more` : "break even"}. ${difference > 0 ? "On cost alone, the pass looks cheaper" : difference < 0 ? "On cost alone, pay-as-you-go looks cheaper" : "Neither is cheaper at this rate"}, assuming your usage stays the same and the pass covers all selected journeys for a full month. This is a projection, not a guarantee or a recommendation to buy for the remaining days of this month. Today's partial day, transfers and refunds are excluded; categories may need review. Other merchants are excluded.`;
}
