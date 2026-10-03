import "server-only";
import { DemoProvider } from "@/providers/financial/DemoProvider";
import { PayPalSandboxProvider } from "@/providers/financial/PayPalSandboxProvider";
import { InMemoryPalRepository } from "@/repositories/InMemoryPalRepository";
import { createDemoFixture } from "@/fixtures/demo";
import { getDashboard } from "@/services/dashboard";
import { readConfig } from "./config";
import { syncFinancialData } from "./syncFinancialData";

/** Composition root: the only application module that chooses a concrete provider. */
export async function loadDashboard() {
  const config = readConfig();
  if (config.FINANCIAL_PROVIDER === "paypal-sandbox") {
    // No demo identity/data fallback in Sandbox mode. Real authenticated binding
    // and durable repository must be wired before enabling the future adapter.
    const provider = new PayPalSandboxProvider({ userId: "unconfigured", accountId: "unconfigured", connectionId: "unconfigured" });
    await provider.getBalance(); // Explicitly fails; this adapter cannot make requests.
    throw new Error("Sandbox composition has not been configured.");
  }
  const binding = { userId: "user-jamie", accountId: "account-main", connectionId: "fixture-account" };
  const fixture = createDemoFixture(binding, config.DEMO_AS_OF);
  const provider = new DemoProvider({ account: fixture.account, asOf: fixture.asOf }, fixture.transactions);
  const repository = new InMemoryPalRepository({ ...fixture, transactions: [], account: { ...fixture.account, currentBalanceCents: 0 } });
  await syncFinancialData(provider, repository, binding.userId);
  return { data: await getDashboard(repository, binding.userId), preview: true };
}
