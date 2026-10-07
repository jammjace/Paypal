import { z } from "zod";
import { centsSchema, timestampSchema } from "./models";
const id = z.string().min(1).max(200);
const nonnegative = centsSchema.refine(n => n >= 0);
export const recurringEventSchema = z.object({
  id, name: z.string().trim().min(1).max(60), direction: z.enum(["IN", "OUT"]),
  amountCents: centsSchema.refine(n => n > 0), startDate: timestampSchema,
  recurrence: z.enum(["ONCE", "MONTHLY"]),
}).strict();
export type RecurringEvent = z.infer<typeof recurringEventSchema>;
export const scenarioRequestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("BUDGET"), bucketId: id, increaseCents: centsSchema.refine(n => n > 0), sourceGoalId: id.nullable() }).strict(),
  z.object({ kind: z.literal("CONTRIBUTION"), bucketId: id, monthlyCents: nonnegative }).strict(),
  z.object({ kind: z.literal("EVENT"), event: recurringEventSchema }).strict(),
  z.object({ kind: z.literal("REMOVE_EVENT"), eventId: id }).strict(),
]);
export type ScenarioRequest = z.infer<typeof scenarioRequestSchema>;
export const scenarioSchema = z.object({
  id, requestId: z.string().uuid(), request: scenarioRequestSchema, fingerprint: z.string(),
  createdAt: timestampSchema, expiresAt: timestampSchema,
  effects: z.array(z.string()),
  status: z.enum(["PENDING", "APPLIED", "DISCARDED", "EXPIRED"]), message: z.string(),
});
export type FutureScenario = z.infer<typeof scenarioSchema>;
export const clarificationSchema = z.object({
  id, requestId: z.string().uuid(), question: z.string(), fingerprint: z.string(), expiresAt: timestampSchema,
  kind: z.enum(["BUDGET", "PASS"]), amountCents: centsSchema.refine(n => n > 0),
  bucketId: id.nullable(), sourceGoalId: id.nullable(),
  merchants: z.array(z.string()), selectedMerchants: z.array(z.string()),
  step: z.enum(["BUDGET_CHOICE", "MERCHANTS", "COVERAGE", "DONE"]),
  scenarioId: id.nullable(), answer: z.string().nullable(),
});
export type Clarification = z.infer<typeof clarificationSchema>;
