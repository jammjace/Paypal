import "server-only";
import { z } from "zod";

const configSchema = z.object({
  FINANCIAL_PROVIDER: z.enum(["demo", "paypal-sandbox"]).default("demo"),
  DEMO_AS_OF: z.iso.datetime().default("2026-10-15T18:00:00.000Z"),
  PAYPAL_ENV: z.literal("sandbox").default("sandbox"),
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_WEBHOOK_ID: z.string().optional(),
});
export function readConfig() {
  const result = configSchema.safeParse(process.env);
  // Do not serialize the input or Zod error: configuration can contain secrets.
  if (!result.success) throw new Error("Invalid server configuration. Check .env.example.");
  return result.data;
}
