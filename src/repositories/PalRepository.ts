import type { FinancialSnapshot, PalSnapshot } from "@/domain/models";

export interface PalRepository {
  read(userId: string): Promise<PalSnapshot>;
  /** Atomic replacement of the synced window; never changes Pal's buckets/activity. */
  replaceFinancialSnapshot(userId: string, snapshot: FinancialSnapshot): Promise<void>;
}
