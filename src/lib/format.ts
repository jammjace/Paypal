import type { Currency } from "@/domain/models";

export function money(cents: number, currency: Currency = "USD") {
  // Formatting only. All authoritative arithmetic is integer-based upstream.
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}
export function shortDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(date));
}
export function periodLabel(period: { from: string; to: string }) {
  return `${shortDate(period.from)}–${new Date(new Date(period.to).getTime() - 1).getUTCDate()}`;
}
