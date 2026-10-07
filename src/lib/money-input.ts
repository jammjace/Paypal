/** Decimal input -> integer cents without a floating-point multiplication. */
export function parseMoneyInput(value: string): number {
  if (!/^\d{1,13}(\.\d{1,2})?$/.test(value.trim())) throw new Error("Enter a nonnegative amount with at most two decimal places.");
  const [whole, fraction = ""] = value.trim().split(".");
  const cents = Number(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0")));
  if (!Number.isSafeInteger(cents)) throw new Error("Amount exceeds supported range.");
  return cents;
}
export function moneyInput(cents: number) {
  const value = BigInt(cents);
  return `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
}
