import "server-only";
import { getDashboard } from "@/services/dashboard";
import { readConfig } from "./config";
import { currentContext } from "./context";

/** Render from durable state. Reading a page does not re-ingest or reset data. */
export async function loadDashboard() {
  if (readConfig().FINANCIAL_PROVIDER !== "demo") throw new Error("Sandbox integration is not configured.");
  const context = await currentContext();
  if (!context) return null;
  return { data: await getDashboard(context.repository, context.userId), preview: true };
}
