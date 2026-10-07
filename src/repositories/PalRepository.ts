import type { FinancialSnapshot, PalSnapshot } from "@/domain/models";

export interface PalRepository {
  read(userId: string): Promise<PalSnapshot>;
  /** Atomic sync commit. Durable implementations merge source IDs and retain history and local classifications. */
  replaceFinancialSnapshot(userId: string, snapshot: FinancialSnapshot): Promise<void>;
}
