/** Deterministic read migration; the next write persists v2. No history is deleted. */
export function migrateWorkspace(input: unknown): unknown {
  if (!input || typeof input !== "object" || !("schemaVersion" in input) || input.schemaVersion !== 1) return input;
  const state = structuredClone(input) as Record<string, unknown>;
  const buckets = state.buckets as Array<Record<string, unknown>>;
  const activity = state.activity as Array<Record<string, unknown>>;
  const events = state.events as Array<Record<string, unknown>>;
  for (const bucket of buckets) {
    if (bucket.type === "BILL" || bucket.type === "FLEXIBLE") bucket.type = "GOAL";
    if (bucket.type === "SPENDING" && Number(bucket.allocatedAmountCents) > 0) {
      const amount = Number(bucket.allocatedAmountCents);
      const entry = { id: `budget-migration-${bucket.id}`, userId: bucket.userId, bucketId: bucket.id,
        deltaCents: -amount, previousAmountCents: amount, newAmountCents: 0,
        reason: "Released reserved cash: spending budgets now track limits, not savings", createdAt: state.asOf };
      activity.push(entry);
      events.push({ ...entry, kind: "ALLOCATION", transactionId: null });
      bucket.allocatedAmountCents = 0;
    }
  }
  state.schemaVersion = 2;
  return state;
}
