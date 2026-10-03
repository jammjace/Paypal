import type { MoneyCents } from "@/domain/models";

export function assertInteger(value: number): void {
  if (!Number.isSafeInteger(value)) throw new Error("Expected a safe integer.");
}
export function assertNonnegative(value: number): void {
  assertInteger(value);
  if (value < 0) throw new Error("Expected a nonnegative amount.");
}
export function safeNumber(value: bigint): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new Error("Amount exceeds supported range.");
  return result;
}
/** Round nearest, with exact halves away from zero. No decimal intermediates. */
export function roundedRatio(numerator: bigint, denominator: bigint): number {
  if (denominator <= 0n) throw new Error("Expected a positive denominator.");
  const absolute = numerator < 0n ? -numerator : numerator;
  const rounded = (absolute + denominator / 2n) / denominator;
  return safeNumber(numerator < 0n ? -rounded : rounded);
}
export function sumCents(values: readonly MoneyCents[]): MoneyCents {
  return safeNumber(values.reduce((total, value) => {
    assertInteger(value);
    return total + BigInt(value);
  }, 0n));
}
export const addCents = (left: MoneyCents, right: MoneyCents) => sumCents([left, right]);
export const subtractCents = (left: MoneyCents, right: MoneyCents) => sumCents([left, -right]);
export function averageCents(values: readonly MoneyCents[]): MoneyCents | null {
  if (!values.length) return null;
  const total = values.reduce((sum, value) => { assertInteger(value); return sum + BigInt(value); }, 0n);
  return roundedRatio(total, BigInt(values.length));
}
/** Integer basis points: 1250 = 12.5%. Returns rounded integer cents. */
export function applyBasisPoints(cents: MoneyCents, basisPoints: number): MoneyCents {
  assertInteger(cents);
  assertInteger(basisPoints);
  return roundedRatio(BigInt(cents) * BigInt(basisPoints), 10000n);
}
/** Integer tenths of one percent; null means no denominator/baseline. */
export function percentageTenths(numerator: number, denominator: number): number | null {
  assertInteger(numerator);
  assertNonnegative(denominator);
  return denominator === 0 ? null : roundedRatio(BigInt(numerator) * 1000n, BigInt(denominator));
}
