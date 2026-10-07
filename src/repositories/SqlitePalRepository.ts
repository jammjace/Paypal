import { migrateWorkspace } from "@/domain/migrations";
import "server-only";
import { workspaceSchema, type Workspace } from "@/domain/workspace";
import type { FinancialSnapshot } from "@/domain/models";
import { balanceSummary } from "@/finance/allocations";
import { mergeFinancialSnapshot } from "@/services/ingestion";
import { openDatabase } from "@/server/database";
import type { MutablePalRepository } from "./MutablePalRepository";

function validateState(input: Workspace, userId: string): Workspace {
  const state = workspaceSchema.parse(migrateWorkspace(input));
  if (state.user.id !== userId || state.account.userId !== userId || state.buckets.some(b => b.userId !== userId)
    || state.transactions.some(tx => tx.userId !== userId || tx.accountId !== state.account.id || tx.currency !== state.account.currency)
    || [...state.activity, ...state.events, ...state.merchantRules, ...state.allocationRules, ...state.proposedActions, ...state.conversations].some(item => item.userId !== userId)) {
    throw new Error("Resource ownership mismatch.");
  }
  balanceSummary(state.account.currentBalanceCents, state.buckets);
  if (new Set(state.transactions.map(tx => tx.id)).size !== state.transactions.length || new Set(state.transactions.map(tx => tx.providerTransactionId)).size !== state.transactions.length) throw new Error("Duplicate transaction.");
  for (const allocation of state.transactionAllocations) {
    if (!state.transactions.some(tx => tx.id === allocation.transactionId) || !state.buckets.some(b => b.id === allocation.bucketId)) throw new Error("Invalid allocation reference.");
  }
  return state;
}

/** Local SQLite adapter. Schema-versioned normalized documents are atomic units.
 * Services depend only on repository methods; SQL and storage encoding stay here.
 */
export class SqlitePalRepository implements MutablePalRepository {
  constructor(readonly filename: string) {}
  async initialize(input: Workspace): Promise<void> {
    const state = validateState(input, input.user.id);
    const db = openDatabase(this.filename);
    try {
      db.prepare("INSERT INTO workspaces(user_id,schema_version,revision,snapshot_json) VALUES(?,?,?,?) ON CONFLICT(user_id) DO NOTHING")
        .run(state.user.id, 2, state.revision, JSON.stringify(state));
    } finally { db.close(); }
  }
  async read(userId: string): Promise<Workspace> {
    const db = openDatabase(this.filename);
    try {
      const row = db.prepare("SELECT snapshot_json FROM workspaces WHERE user_id = ?").get(userId);
      if (!row) throw new Error("Workspace not found.");
      return validateState(JSON.parse(String(row.snapshot_json)), userId);
    } finally { db.close(); }
  }
  async transact<T>(userId: string, operation: (state: Workspace) => T): Promise<T> {
    const db = openDatabase(this.filename);
    try {
      db.exec("BEGIN IMMEDIATE");
      const row = db.prepare("SELECT snapshot_json FROM workspaces WHERE user_id = ?").get(userId);
      if (!row) throw new Error("Workspace not found.");
      const state = validateState(JSON.parse(String(row.snapshot_json)), userId);
      const before = JSON.stringify(state);
      const result = operation(state);
      if (result instanceof Promise) throw new Error("Repository transactions must be synchronous.");
      const validated = validateState(state, userId);
      if (JSON.stringify(validated) !== before) {
        validated.revision++;
        db.prepare("UPDATE workspaces SET schema_version = 2, revision = ?, snapshot_json = ? WHERE user_id = ?")
          .run(validated.revision, JSON.stringify(validated), userId);
      }
      db.exec("COMMIT");
      return structuredClone(result);
    } catch (error) {
      if (db.isTransaction) db.exec("ROLLBACK");
      throw error;
    } finally { db.close(); }
  }
  async replaceFinancialSnapshot(userId: string, input: FinancialSnapshot): Promise<void> {
    await this.transact(userId, state => mergeFinancialSnapshot(state, input, userId));
  }
}