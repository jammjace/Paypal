import { z } from "zod";
import { timestampSchema } from "./models";

/** A bounded read-only query language, not arbitrary model-generated code or SQL. */
export const analysisStepSchema = z.object({
  operation: z.enum(["SPENDING", "COMPARE", "RATE", "REDUCE", "ALTERNATIVE", "AFFORDABILITY", "BALANCE", "BUCKET", "INCOME", "GOALS"]),
  merchants: z.array(z.string()).max(10), categories: z.array(z.string()).max(10),
  period: z.enum(["MONTH_TO_DATE", "PREVIOUS_MONTH"]),
  bucket: z.string().nullable(),
  amount: z.string().nullable().describe("Explicit dollar input, not a calculated result."),
  percent: z.string().nullable().describe("Explicit percentage reduction input, e.g. 20, not a calculated result."),
  coverage: z.enum(["UNKNOWN", "ALL", "QUOTA", "DISCOUNT"]),
  includedCount: z.number().int().min(0).max(100000).nullable(),
  extraUnitPrice: z.string().nullable(),
}).strict();
export type AnalysisStep = z.infer<typeof analysisStepSchema>;
export const analysisPlanSchema = z.object({
  steps: z.array(analysisStepSchema).max(5),
  clarification: z.string().max(500).nullable(),
}).strict();
export type AnalysisPlan = z.infer<typeof analysisPlanSchema>;
export const analysisThreadSchema = z.object({
  id: z.string(), requestId: z.string().uuid(), expiresAt: timestampSchema,
  messages: z.array(z.object({ question: z.string().max(500), answer: z.string(), requestId: z.string().uuid() })).max(8),
  plan: analysisPlanSchema, pending: z.boolean(), closed: z.boolean(),
  lastReply: z.object({ answer: z.string(), mode: z.string(), notice: z.string(), asOf: timestampSchema, choices: z.array(z.object({ value: z.string(), label: z.string() })) }),
});
export type AnalysisThread = z.infer<typeof analysisThreadSchema>;
