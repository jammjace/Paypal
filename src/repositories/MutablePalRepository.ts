import type { PalRepository } from "./PalRepository";
import type { Workspace } from "@/domain/workspace";

export interface MutablePalRepository extends PalRepository {
  read(userId: string): Promise<Workspace>;
  /** Synchronous callback, committed atomically with the audit trail or rolled back. */
  transact<T>(userId: string, operation: (state: Workspace) => T): Promise<T>;
}
