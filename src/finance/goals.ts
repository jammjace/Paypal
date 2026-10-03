import type { MoneyCents } from "@/domain/models";
import { assertInteger, assertNonnegative, safeNumber } from "./money";
import { utcDay } from "./periods";

export interface GoalProjectionInput {
  allocatedAmountCents: MoneyCents; targetAmountCents: MoneyCents;
  asOf: string; targetDate: string;
  contributionCents: MoneyCents; intervalDays: number;
}
const ceilDivide = (amount: bigint, count: bigint) => (amount + count - 1n) / count;
const DAY_MS = 86_400_000;

/** Fixed-day contributions begin one interval AFTER asOf; due day is included.
 * No income, bill or growth assumptions. Calendar-month timelines belong to M6.
 */
export function projectGoal(input: GoalProjectionInput) {
  const { allocatedAmountCents, targetAmountCents, contributionCents, intervalDays } = input;
  [allocatedAmountCents, targetAmountCents, contributionCents].forEach(assertNonnegative);
  assertInteger(intervalDays);
  if (intervalDays <= 0) throw new Error("Contribution interval must be positive.");
  const today = utcDay(input.asOf), deadline = utcDay(input.targetDate);
  const daysLeft = (deadline.getTime() - today.getTime()) / DAY_MS;
  const opportunities = Math.max(0, Math.floor(daysLeft / intervalDays));
  const remainingCents = Math.max(0, targetAmountCents - allocatedAmountCents);
  const funded = remainingCents === 0;
  const projectedCents = funded ? allocatedAmountCents : safeNumber(BigInt(allocatedAmountCents) + BigInt(contributionCents) * BigInt(opportunities));
  const shortfallCents = Math.max(0, targetAmountCents - projectedCents);
  let projectedFundedAt: string | null = funded ? today.toISOString() : null;
  if (!funded && contributionCents > 0) {
    const count = ceilDivide(BigInt(remainingCents), BigInt(contributionCents));
    const time = safeNumber(BigInt(today.getTime()) + count * BigInt(intervalDays) * BigInt(DAY_MS));
    const date = new Date(time);
    if (Number.isNaN(date.getTime())) throw new Error("Projected date exceeds supported range.");
    projectedFundedAt = date.toISOString();
  }
  return {
    remainingCents, contributionOpportunities: opportunities,
    requiredPerContributionCents: funded ? 0 : opportunities === 0 ? null : safeNumber(ceilDivide(BigInt(remainingCents), BigInt(opportunities))),
    projectedCents, shortfallCents, projectedFundedAt,
    status: funded ? "FUNDED" as const : daysLeft < 0 ? "OVERDUE" as const : shortfallCents === 0 ? "ON_TRACK" as const : "SHORTFALL" as const,
  };
}
