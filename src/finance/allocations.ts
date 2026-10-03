import type { Bucket, MoneyCents } from "@/domain/models";
import { addCents, assertInteger, assertNonnegative, subtractCents, sumCents } from "./money";

function validateBuckets(buckets: readonly Bucket[]) {
  const ids = new Set<string>();
  let owner: string | undefined;
  for (const bucket of buckets) {
    assertNonnegative(bucket.allocatedAmountCents);
    assertNonnegative(bucket.targetAmountCents);
    if (!bucket.id || ids.has(bucket.id)) throw new Error("Duplicate or missing bucket ID.");
    if (!bucket.userId || (owner !== undefined && bucket.userId !== owner)) throw new Error("Buckets must share one owner.");
    if (bucket.status !== "ACTIVE" && bucket.status !== "ARCHIVED") throw new Error("Unknown bucket status.");
    if (bucket.status === "ARCHIVED" && bucket.allocatedAmountCents !== 0) throw new Error("Release earmarks before archiving a bucket.");
    ids.add(bucket.id);
    owner = bucket.userId;
  }
}
export function balanceSummary(balanceCents: MoneyCents, buckets: readonly Bucket[]) {
  assertInteger(balanceCents);
  validateBuckets(buckets);
  const earmarkedCents = sumCents(buckets.filter(bucket => bucket.status === "ACTIVE").map(bucket => bucket.allocatedAmountCents));
  return { balanceCents, earmarkedCents, safeToSpendCents: subtractCents(balanceCents, earmarkedCents) };
}
export interface AllocationChange { bucketId: string; deltaCents: MoneyCents }
/** Pure impact calculation. No persistence, approval or money movement. */
export function previewAllocation(balanceCents: MoneyCents, buckets: readonly Bucket[], changes: readonly AllocationChange[], userId: string) {
  const before = balanceSummary(balanceCents, buckets);
  if (!userId || buckets.some(bucket => bucket.userId !== userId)) throw new Error("Bucket ownership mismatch.");
  if (!changes.length) throw new Error("At least one allocation change is required.");
  const next = buckets.map(bucket => ({ ...bucket }));
  const changed = new Set<string>();
  const impacts = changes.map(change => {
    assertInteger(change.deltaCents);
    if (change.deltaCents === 0 || changed.has(change.bucketId)) throw new Error("Duplicate or empty allocation change.");
    changed.add(change.bucketId);
    const bucket = next.find(bucket => bucket.id === change.bucketId);
    if (!bucket || bucket.status !== "ACTIVE") throw new Error("Active bucket not found.");
    const previousAmountCents = bucket.allocatedAmountCents;
    const newAmountCents = addCents(previousAmountCents, change.deltaCents);
    if (newAmountCents < 0) throw new Error("Source bucket has insufficient earmarks.");
    bucket.allocatedAmountCents = newAmountCents;
    return { ...change, previousAmountCents, newAmountCents };
  });
  const after = balanceSummary(balanceCents, next);
  if (after.safeToSpendCents < Math.min(0, before.safeToSpendCents)) throw new Error("Insufficient unearmarked balance for this allocation.");
  return { before, after, changes: impacts, buckets: next };
}
