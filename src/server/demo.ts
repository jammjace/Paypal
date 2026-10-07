import "server-only";
import { randomUUID } from "node:crypto";
import { createDemoFixture } from "@/fixtures/demo";
import { workspaceFromSnapshot } from "@/domain/workspace";
import { DemoProvider } from "@/providers/financial/DemoProvider";
import type { MutablePalRepository } from "@/repositories/MutablePalRepository";
import { readConfig } from "./config";
import { storage } from "./context";
import { syncFinancialData } from "./syncFinancialData";

function demoFixture(userId: string, accountId: string, connectionId: string, asOf: string) {
  return createDemoFixture({ userId, accountId, connectionId }, asOf);
}
export async function createDemoSession() {
  const config = readConfig();
  if (config.FINANCIAL_PROVIDER !== "demo") throw new Error("Configured provider is unavailable.");
  const { repository, sessions } = storage();
  const userId = randomUUID();
  const fixture = demoFixture(userId, randomUUID(), randomUUID(), config.DEMO_AS_OF);
  await repository.initialize(workspaceFromSnapshot({ ...fixture, transactions: [], account: { ...fixture.account, currentBalanceCents: 0 } }));
  await syncFinancialData(new DemoProvider({ account: fixture.account, asOf: fixture.asOf }, fixture.transactions), repository, userId);
  return sessions.issue(userId);
}
export async function syncWorkspace(repository: MutablePalRepository, userId: string) {
  if (readConfig().FINANCIAL_PROVIDER !== "demo") throw new Error("Configured provider is unavailable.");
  const state = await repository.read(userId);
  // A workspace's demo clock is durable; changing configuration must not silently
  // reinterpret source IDs as a different month's transactions.
  const fixture = demoFixture(userId, state.account.id, state.account.providerAccountId, state.asOf);
  await syncFinancialData(new DemoProvider({ account: fixture.account, asOf: fixture.asOf }, fixture.transactions), repository, userId);
}
export async function resetDemo(repository: MutablePalRepository, userId: string) {
  if (readConfig().FINANCIAL_PROVIDER !== "demo") throw new Error("Configured provider is unavailable.");
  await repository.transact(userId, state => {
    const fixture = demoFixture(userId, state.account.id, state.account.providerAccountId, readConfig().DEMO_AS_OF);
    const reset = workspaceFromSnapshot({ ...fixture, transactions: fixture.transactions.filter(tx => tx.transactionDate <= fixture.asOf) });
    Object.assign(state, { ...reset, revision: state.revision });
  });
}
