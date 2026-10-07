import { randomUUID } from "node:crypto";
import type { Workspace, PalEvent } from "@/domain/workspace";
import { previewAllocation, type AllocationChange } from "@/finance/allocations";

export function recordEvent(state: Workspace, kind: PalEvent["kind"], reason: string, at: string, bucketId: string | null = null, transactionId: string | null = null, deltaCents: number | null = null) {
  state.events.push({ id: randomUUID(), userId: state.user.id, kind, reason, bucketId, transactionId, deltaCents, createdAt: at });
}
export function applyAllocation(state: Workspace, changes: AllocationChange[], reason: string, at: string) {
  const preview = previewAllocation(state.account.currentBalanceCents, state.buckets, changes, state.user.id);
  state.buckets = preview.buckets;
  for (const impact of preview.changes) {
    state.activity.push({ id: randomUUID(), userId: state.user.id, ...impact, reason, createdAt: at });
    recordEvent(state, "ALLOCATION", reason, at, impact.bucketId, null, impact.deltaCents);
  }
}
