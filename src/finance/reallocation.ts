import type { Bucket } from "@/domain/models";
import { reallocationRequestSchema, type ReallocationOption, type ReallocationRequest } from "@/domain/proposals";
import { balanceSummary, previewAllocation, type AllocationChange } from "./allocations";
import { subtractCents } from "./money";
import { money } from "@/lib/format";

/** Deterministic scenarios; proposals never use spending limits as cash. */
export function reallocationOptions(balanceCents: number, buckets: readonly Bucket[], input: ReallocationRequest, userId: string): ReallocationOption[] {
  const request = reallocationRequestSchema.parse(input);
  balanceSummary(balanceCents, buckets);
  if (buckets.some(b => b.userId !== userId)) throw new Error("Bucket ownership mismatch.");
  const goal = (id: string) => {
    const b = buckets.find(b => b.id === id && b.status === "ACTIVE");
    if (!b || b.type !== "GOAL") throw new Error("Choose active savings goals. Spending budgets are limits, not money to move.");
    return b;
  };
  const destination = request.destinationBucketId ? goal(request.destinationBucketId) : null;
  const source = request.sourceBucketId ? goal(request.sourceBucketId) : null;
  if ((request.funding === "GOAL") !== !!source || (!destination && !source) || source?.id === destination?.id) throw new Error("Choose distinct savings goals or Safe to Spend.");
  const results: ReallocationOption[] = [];
  const add = (id: string, title: string, sources: AllocationChange[], cashCents: number) => {
    const changes = [...sources, ...(destination ? [{ bucketId: destination.id, deltaCents: request.amountCents }] : [])];
    if (results.some(option => JSON.stringify(option.changes) === JSON.stringify(changes))) return;
    try {
      const preview = previewAllocation(balanceCents, buckets, changes, userId);
      const warnings: string[] = [];
      for (const change of sources) {
        const donor = goal(change.bucketId);
        if (destination && donor.priority < destination.priority) warnings.push(`${donor.name} has a higher priority than ${destination.name}.`);
        if (donor.targetAmountCents > Math.max(0, donor.allocatedAmountCents + change.deltaCents)) warnings.push(`Taking money from ${donor.name} increases its amount still to save.`);
      }
      results.push({ id, title, changes, before: preview.before, after: preview.after, warnings,
        explanation: destination
          ? `Add ${money(request.amountCents)} to ${destination.name}${cashCents > 0 ? `, using ${money(cashCents)} from Safe to Spend` : " while keeping Safe to Spend unchanged"}.`
          : `Release ${money(request.amountCents)} from ${source!.name} to Safe to Spend.`,
        goals: preview.changes.map(change => {
          const bucket = goal(change.bucketId);
          return { bucketId: bucket.id, name: bucket.name, previousAmountCents: change.previousAmountCents, newAmountCents: change.newAmountCents,
            targetAmountCents: bucket.targetAmountCents, previousGapCents: Math.max(0, subtractCents(bucket.targetAmountCents, change.previousAmountCents)),
            newGapCents: Math.max(0, subtractCents(bucket.targetAmountCents, change.newAmountCents)) };
        }) });
    } catch { /* Unaffordable candidates are not offered. Invalid inputs were checked above. */ }
  };
  if (request.funding === "GOAL") {
    add("specified-source", `Use ${source!.name}`, [{ bucketId: source!.id, deltaCents: -request.amountCents }], 0);
  } else if (request.funding === "SAFE_TO_SPEND") {
    add("safe-to-spend", "Use Safe to Spend", [], request.amountCents);
  } else {
    add("safe-to-spend", "Use Safe to Spend", [], request.amountCents);
    const donors = buckets.filter(b => b.status === "ACTIVE" && b.type === "GOAL" && b.id !== destination!.id && b.allocatedAmountCents > 0)
      .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
    for (const donor of donors) {
      if (results.length >= 4) break;
      add(`goal-${donor.id}`, `Use ${donor.name}`, [{ bucketId: donor.id, deltaCents: -request.amountCents }], 0);
    }
    const cash = Math.min(request.amountCents, Math.max(0, balanceSummary(balanceCents, buckets).safeToSpendCents));
    let needed = subtractCents(request.amountCents, cash);
    const changes: AllocationChange[] = [];
    for (const donor of donors) {
      if (!needed) break;
      const take = Math.min(needed, donor.allocatedAmountCents);
      changes.push({ bucketId: donor.id, deltaCents: -take });
      needed = subtractCents(needed, take);
    }
    if (!needed && changes.length) add("combined", "Combine available funds", changes, cash);
  }
  if (!results.length) throw new Error("There is not enough available money for this request. Try a smaller amount or another source.");
  return results;
}
