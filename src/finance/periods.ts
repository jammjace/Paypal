import { timestampSchema } from "@/domain/models";

/** UTC half-open interval, independent of host locale and provider. */
export interface Period { from: string; to: string }
export interface ComparisonPeriods { current: Period; previous: Period }
export type PeriodSelection =
  | { mode: "MONTH_TO_DATE" | "PREVIOUS_MONTH_EQUIVALENT_DAYS" | "PREVIOUS_MONTH" }
  | { mode: "CUSTOM"; from: string; to: string };

export function validatePeriod(period: Period): Period {
  const from = timestampSchema.parse(period.from);
  const to = timestampSchema.parse(period.to);
  if (from >= to) throw new Error("Period end must follow its start.");
  return { from, to };
}
export function utcDate(year: number, month: number, day: number): Date {
  // Also handles years 0000–0099, unlike Date.UTC's implicit 1900 offset.
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  return date;
}
export function utcDay(timestamp: string): Date {
  const date = new Date(timestampSchema.parse(timestamp));
  return utcDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
export function resolvePeriod(selection: PeriodSelection, asOf: string): Period {
  const date = new Date(timestampSchema.parse(asOf));
  if (selection.mode === "CUSTOM") return validatePeriod(selection);
  const year = date.getUTCFullYear(), month = date.getUTCMonth(), day = date.getUTCDate();
  const previousDays = utcDate(year, month, 0).getUTCDate();
  switch (selection.mode) {
    case "MONTH_TO_DATE":
      return { from: utcDate(year, month, 1).toISOString(), to: utcDate(year, month, day + 1).toISOString() };
    case "PREVIOUS_MONTH_EQUIVALENT_DAYS":
      return { from: utcDate(year, month - 1, 1).toISOString(), to: utcDate(year, month - 1, Math.min(day, previousDays) + 1).toISOString() };
    case "PREVIOUS_MONTH":
      return { from: utcDate(year, month - 1, 1).toISOString(), to: utcDate(year, month, 1).toISOString() };
    default:
      throw new Error("Unsupported period mode.");
  }
}
export function equivalentPeriods(asOf: string): ComparisonPeriods {
  return { current: resolvePeriod({ mode: "MONTH_TO_DATE" }, asOf), previous: resolvePeriod({ mode: "PREVIOUS_MONTH_EQUIVALENT_DAYS" }, asOf) };
}
