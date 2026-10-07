import type { Workspace } from "@/domain/workspace";
import { scenarioRequestSchema, type ScenarioRequest } from "@/domain/future";
import { balanceSummary, previewAllocation } from "./allocations";
import { addCents, subtractCents } from "./money";
import { bucketProgress } from "./buckets";
import { money } from "@/lib/format";

export function simulateChange(state: Workspace, input: ScenarioRequest) {
  const request = scenarioRequestSchema.parse(input), next = structuredClone(state);
  const effects: string[] = [];
  let allocations: { bucketId: string; deltaCents: number }[] = [];
  const active = (id: string, kind: "SPENDING" | "GOAL") => {
    const bucket = next.buckets.find(b => b.id === id && b.type === kind && b.status === "ACTIVE" && b.userId === state.user.id);
    if (!bucket) throw new Error(`Choose an active ${kind === "GOAL" ? "savings goal" : "spending budget"}.`);
    return bucket;
  };
  if (request.kind === "BUDGET") {
    const bucket = active(request.bucketId, "SPENDING");
    const before = bucketProgress(bucket, next.transactions, next.asOf);
    if (before.kind !== "SPENDING") throw new Error("Expected spending budget.");
    const limit = addCents(before.limitCents, request.increaseCents);
    bucket.limitOverride = { amountCents: limit, from: before.from, to: before.to };
    effects.push(`${bucket.name} limit: ${money(before.limitCents)} → ${money(limit)}. Remaining allowance: ${money(before.remainingCents)} → ${money(addCents(before.remainingCents, request.increaseCents))}.`,
      `Only for ${before.from.slice(0, 10)} through ${new Date(new Date(before.to).getTime() - 1).toISOString().slice(0, 10)} UTC. Future periods keep the usual ${money(bucket.targetAmountCents)} limit. Raising a limit does not reserve money.`);
    if (request.sourceGoalId) {
      const source = active(request.sourceGoalId, "GOAL");
      allocations = [{ bucketId: source.id, deltaCents: -request.increaseCents }];
      const preview = previewAllocation(next.account.currentBalanceCents, next.buckets, allocations, state.user.id);
      next.buckets = preview.buckets;
      effects.push(`${source.name} savings: ${money(source.allocatedAmountCents)} → ${money(subtractCents(source.allocatedAmountCents, request.increaseCents))}. Released to Safe to Spend, not reserved for ${bucket.name}.`);
    }
  } else if (request.kind === "CONTRIBUTION") {
    const bucket = active(request.bucketId, "GOAL");
    effects.push(`${bucket.name} monthly contribution plan: ${money(bucket.monthlyContributionCents ?? 0)} → ${money(request.monthlyCents)}. No contribution is made now or automatically later.`);
    bucket.monthlyContributionCents = request.monthlyCents;
  } else if (request.kind === "EVENT") {
    if (next.recurringEvents.some(e => e.id === request.event.id)) throw new Error("This event already exists.");
    if (request.event.startDate <= state.asOf) throw new Error("Choose an event date after the snapshot.");
    if (next.recurringEvents.length >= 50) throw new Error("Keep at most 50 planned events.");
    next.recurringEvents.push(request.event);
    effects.push(`Plan ${request.event.name}: ${request.event.direction === "IN" ? "income" : "expense"} ${money(request.event.amountCents)}, ${request.event.recurrence.toLowerCase()}, starting ${request.event.startDate.slice(0, 10)}. Projection only; no payment is scheduled.`);
  } else {
    const event = next.recurringEvents.find(e => e.id === request.eventId);
    if (!event) throw new Error("Planned event not found.");
    next.recurringEvents = next.recurringEvents.filter(e => e.id !== event.id);
    effects.push(`Remove ${event.name} from future projections. No payment is cancelled.`);
  }
  const before = balanceSummary(state.account.currentBalanceCents, state.buckets), after = balanceSummary(next.account.currentBalanceCents, next.buckets);
  effects.push(`Safe to Spend: ${money(before.safeToSpendCents)} → ${money(after.safeToSpendCents)}. Savings set aside: ${money(before.earmarkedCents)} → ${money(after.earmarkedCents)}. Account balance stays ${money(after.balanceCents)}.`);
  return { next, effects, allocations, before, after };
}

/** Anchored calendar months, clamping Jan 31 to Feb 28/29 without drifting March to the 28th. */
export function calendarOccurrence(anchor: string, offset: number) {
  const start = new Date(anchor);
  const first = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + offset, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(start.getUTCDate(), lastDay), start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds())).toISOString();
}
export function projectFuture(state: Workspace, months = 12) {
  if (!Number.isInteger(months) || months < 1 || months > 24) throw new Error("Projection horizon must be 1–24 months.");
  const today = new Date(state.asOf), end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + months + 1, 1)).toISOString();
  const goals = state.buckets.filter(b => b.status === "ACTIVE" && b.type === "GOAL").map(b => ({ ...b }));
  const scheduled: { date: string; name: string; amountCents: number; direction: "IN" | "OUT" | "SAVE"; goalId?: string }[] = [];
  for (const event of state.recurringEvents) {
    const anchor = new Date(event.startDate);
    const offset = Math.max(0, (today.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + today.getUTCMonth() - anchor.getUTCMonth());
    const offsets = event.recurrence === "ONCE" ? [0] : Array.from({ length: months + 2 }, (_, i) => offset + i);
    for (const n of offsets) {
      const date = calendarOccurrence(event.startDate, n);
      if (date > state.asOf && date < end) scheduled.push({ date, name: event.name, amountCents: event.amountCents, direction: event.direction });
    }
  }
  for (let n = 1; n <= months; n++) {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + n, 1, 23, 59, 59)).toISOString();
    for (const goal of [...goals].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))) {
      if (goal.monthlyContributionCents) scheduled.push({ date, name: `${goal.name} planned contribution`, amountCents: goal.monthlyContributionCents, direction: "SAVE", goalId: goal.id });
    }
  }
  scheduled.sort((a, b) => a.date.localeCompare(b.date) || ({ IN: 0, OUT: 1, SAVE: 2 }[a.direction] - { IN: 0, OUT: 1, SAVE: 2 }[b.direction]));
  let balanceCents = state.account.currentBalanceCents;
  const fundedAt = new Map(goals.filter(g => g.targetAmountCents > 0 && g.allocatedAmountCents >= g.targetAmountCents).map(g => [g.id, state.asOf]));
  const timeline = scheduled.map(item => {
    let appliedCents = item.amountCents, shortfallCents = 0;
    if (item.direction === "SAVE") {
      const goal = goals.find(g => g.id === item.goalId)!;
      const intended = goal.targetAmountCents > 0 ? Math.min(item.amountCents, Math.max(0, subtractCents(goal.targetAmountCents, goal.allocatedAmountCents))) : item.amountCents;
      const safe = balanceSummary(balanceCents, goals).safeToSpendCents;
      appliedCents = Math.min(intended, Math.max(0, safe));
      shortfallCents = subtractCents(intended, appliedCents);
      goal.allocatedAmountCents = addCents(goal.allocatedAmountCents, appliedCents);
      if (goal.targetAmountCents > 0 && goal.allocatedAmountCents >= goal.targetAmountCents && !fundedAt.has(goal.id)) fundedAt.set(goal.id, item.date);
    } else balanceCents = item.direction === "IN" ? addCents(balanceCents, item.amountCents) : subtractCents(balanceCents, item.amountCents);
    return { ...item, appliedCents, shortfallCents, ...balanceSummary(balanceCents, goals) };
  });
  return { end, timeline, final: balanceSummary(balanceCents, goals), goals: goals.map(g => ({ id: g.id, name: g.name, targetCents: g.targetAmountCents, projectedCents: g.allocatedAmountCents,
    fundedAt: fundedAt.get(g.id) ?? null, targetDate: g.targetDate,
    onTime: g.targetDate && fundedAt.has(g.id) ? fundedAt.get(g.id)! <= g.targetDate : null })) };
}
