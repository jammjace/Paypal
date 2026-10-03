import { describe, expect, it } from "vitest";
import { DemoProvider } from "@/providers/financial/DemoProvider";
import { PayPalSandboxProvider } from "@/providers/financial/PayPalSandboxProvider";
import type { FinancialProvider } from "@/providers/financial/FinancialProvider";
import type { TransactionQuery } from "@/providers/financial/types";
import { createDemoFixture } from "@/fixtures/demo";
import { InMemoryPalRepository } from "@/repositories/InMemoryPalRepository";
import { syncFinancialData } from "@/server/syncFinancialData";
import { getDashboard } from "@/services/dashboard";
import { transactionSchema } from "@/domain/models";

const binding = { userId: "user-test", accountId: "account-test", connectionId: "source-test" };
const fixture = () => createDemoFixture(binding, "2026-10-15T18:00:00.000Z");
const demo = () => { const data = fixture(); return new DemoProvider({ account: data.account, asOf: data.asOf }, data.transactions); };
const repository = () => new InMemoryPalRepository({ ...fixture(), transactions: [], account: { ...fixture().account, currentBalanceCents: 0 } });

/** Independent implementation; different provenance, IDs, order and page size.
 * It intentionally does not extend or delegate to DemoProvider.
 */
class AlternateProvider implements FinancialProvider {
  async getBalance() {
    const data = fixture();
    return { account: { ...data.account, provider: "alternate", providerAccountId: "external-42" }, asOf: data.asOf };
  }
  async getTransactions(query: TransactionQuery) {
    const rows = fixture().transactions.filter(tx => tx.transactionDate >= query.from && tx.transactionDate < query.to).reverse()
      .map(tx => ({ ...tx, id: `alternate-${tx.id}`, providerTransactionId: `external-${tx.providerTransactionId}` }));
    const offset = Number(query.cursor ?? 0);
    return { transactions: rows.slice(offset, offset + 3), nextCursor: offset + 3 < rows.length ? String(offset + 3) : null };
  }
}

async function dashboardFrom(provider: FinancialProvider) {
  const repo = repository();
  await syncFinancialData(provider, repo, binding.userId);
  return getDashboard(repo, binding.userId);
}

describe("provider-independent finance behavior", () => {
  it("produces identical dashboard calculations with an independently implemented replacement provider", async () => {
    const first = await dashboardFrom(demo());
    const swapped = await dashboardFrom(new AlternateProvider());
    expect(first.balance).toEqual({ balanceCents: 243000, earmarkedCents: 194400, safeToSpendCents: 48600 });
    expect(first.spending.currentCents).toBe(74200);
    expect(first.spending.previousCents).toBe(89100);
    expect(first.spending.percentChangeTenths).toBe(-167);
    expect(first.spending.merchants.find(merchant => merchant.name === "Luckin Coffee")?.totalCents).toBe(8460);
    expect(swapped.balance).toEqual(first.balance);
    expect(swapped.spending).toEqual(first.spending);
    expect(swapped.buckets).toEqual(first.buckets);
  });
  it("does not hardcode the sample balance or dates into consumers", async () => {
    const data = createDemoFixture(binding, "2027-02-15T18:00:00.000Z");
    data.account.currentBalanceCents = 500000;
    const provider = new DemoProvider({ account: data.account, asOf: data.asOf }, data.transactions);
    const result = await dashboardFrom(provider);
    expect(result.balance.safeToSpendCents).toBe(305600);
    expect(result.spending.periods.current.from).toBe("2027-02-01T00:00:00.000Z");
  });
});

describe("normalized boundary", () => {
  it("paginates and respects exclusive upper date bounds", async () => {
    const provider = demo();
    const query = { from: "2026-10-01T00:00:00.000Z", to: "2026-10-02T00:00:00.000Z", limit: 1 };
    const first = await provider.getTransactions(query);
    expect(first.transactions).toHaveLength(1);
    expect(first.nextCursor).not.toBeNull();
    const second = await provider.getTransactions({ ...query, cursor: first.nextCursor! });
    expect(second.transactions).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    expect(second.transactions[0].id).not.toBe(first.transactions[0].id);
    expect([...first.transactions, ...second.transactions].every(tx => tx.transactionDate < query.to)).toBe(true);
  });
  it("returns defensive copies", async () => {
    const provider = demo();
    const first = await provider.getBalance();
    first.account.currentBalanceCents = 0;
    expect((await provider.getBalance()).account.currentBalanceCents).toBe(243000);
  });
  it("rejects fractional cents, unsupported currency, and negative transaction amounts", () => {
    const tx = fixture().transactions[0];
    for (const patch of [{ amountCents: 10.25 }, { amountCents: -1 }, { currency: "EUR" }, { amountCents: Number.MAX_SAFE_INTEGER + 1 }]) {
      expect(transactionSchema.safeParse({ ...tx, ...patch }).success).toBe(false);
    }
  });
  it("canonicalizes UTC timestamp precision before date comparisons", () => {
    const tx = transactionSchema.parse({ ...fixture().transactions[0], transactionDate: "2026-10-01T12:00:00Z" });
    expect(tx.transactionDate).toBe("2026-10-01T12:00:00.000Z");
  });
  it("rejects cross-user access", async () => {
    const repo = repository();
    await expect(syncFinancialData(demo(), repo, "another-user")).rejects.toThrow("ownership");
    await expect(repo.read("another-user")).rejects.toThrow("ownership");
  });
  it("rejects a cross-account transaction before writing any snapshot", async () => {
    const provider = demo(), repo = repository();
    const invalid: FinancialProvider = { getBalance: () => provider.getBalance(), getTransactions: async query => {
      const page = await provider.getTransactions(query);
      page.transactions[0].accountId = "another-account";
      return page;
    } };
    await expect(syncFinancialData(invalid, repo, binding.userId)).rejects.toThrow("out-of-scope");
    expect((await repo.read(binding.userId)).account.currentBalanceCents).toBe(0);
  });
  it("rejects duplicate source transactions without double counting", async () => {
    const provider = demo(), repo = repository();
    const duplicate: FinancialProvider = { getBalance: () => provider.getBalance(), getTransactions: async query => {
      const page = await provider.getTransactions(query);
      return { ...page, transactions: [...page.transactions, page.transactions[0]] };
    } };
    await expect(syncFinancialData(duplicate, repo, binding.userId)).rejects.toThrow("duplicate");
    expect((await repo.read(binding.userId)).transactions).toHaveLength(0);
  });
  it("fails a repeated pagination cursor rather than looping indefinitely", async () => {
    const provider = demo();
    const looping: FinancialProvider = { getBalance: () => provider.getBalance(), getTransactions: async () => ({ transactions: [], nextCursor: "repeat" }) };
    await expect(syncFinancialData(looping, repository(), binding.userId)).rejects.toThrow("pagination");
  });
  it("is idempotent across repeated snapshot syncs and preserves bucket state", async () => {
    const repo = repository(), provider = demo();
    await syncFinancialData(provider, repo, binding.userId);
    const initial = await repo.read(binding.userId);
    await syncFinancialData(provider, repo, binding.userId);
    expect(await repo.read(binding.userId)).toEqual(initial);
    expect(initial.buckets).toEqual(fixture().buckets);
  });
  it("never silently substitutes demo data when Sandbox is selected", async () => {
    const provider = new PayPalSandboxProvider(binding);
    await expect(provider.getBalance()).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
    await expect(provider.getTransactions({ from: "2026-10-01T00:00:00.000Z", to: "2026-10-16T00:00:00.000Z" })).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
  });
});
