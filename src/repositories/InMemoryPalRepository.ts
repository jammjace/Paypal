import "server-only";
import type { FinancialSnapshot, PalSnapshot } from "@/domain/models";
import type { PalRepository } from "./PalRepository";

export class InMemoryPalRepository implements PalRepository {
  private state: PalSnapshot;
  constructor(initial: PalSnapshot) { this.state = structuredClone(initial); }
  async read(userId: string): Promise<PalSnapshot> {
    this.assertOwner(userId);
    return structuredClone(this.state);
  }
  async replaceFinancialSnapshot(userId: string, snapshot: FinancialSnapshot): Promise<void> {
    this.assertOwner(userId);
    if (snapshot.account.userId !== userId || snapshot.account.id !== this.state.account.id || snapshot.transactions.some(tx => tx.userId !== userId || tx.accountId !== snapshot.account.id)) {
      throw new Error("Resource ownership mismatch.");
    }
    this.state = { ...this.state, ...structuredClone(snapshot) };
  }
  private assertOwner(userId: string) {
    if (this.state.user.id !== userId) throw new Error("Resource ownership mismatch.");
  }
}
