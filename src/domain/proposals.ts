import { z } from "zod";
import { centsSchema, timestampSchema } from "./models";

const id = z.string().min(1).max(200);
export const reallocationRequestSchema = z.object({
  destinationBucketId: id.nullable(),
  funding: z.enum(["AUTO", "SAFE_TO_SPEND", "GOAL"]),
  sourceBucketId: id.nullable(),
  amountCents: centsSchema.refine(n => n > 0),
}).strict();
export type ReallocationRequest = z.infer<typeof reallocationRequestSchema>;
const totals = z.object({ balanceCents: centsSchema, earmarkedCents: centsSchema, safeToSpendCents: centsSchema });
export const reallocationOptionSchema = z.object({
  id, title: z.string(), explanation: z.string(), warnings: z.array(z.string()),
  changes: z.array(z.object({ bucketId: id, deltaCents: centsSchema })).min(1),
  before: totals, after: totals,
  goals: z.array(z.object({ bucketId: id, name: z.string(), previousAmountCents: centsSchema, newAmountCents: centsSchema,
    targetAmountCents: centsSchema, previousGapCents: centsSchema, newGapCents: centsSchema })),
});
export type ReallocationOption = z.infer<typeof reallocationOptionSchema>;
// Additive v2 field: old placeholder ProposedActions remain readable but not executable.
export const reallocationDetailsSchema = z.object({
  requestId: z.string().uuid(), fingerprint: z.string(), expiresAt: timestampSchema,
  options: z.array(reallocationOptionSchema).min(1).max(5),
  selectedOptionId: id.nullable(), resolvedAt: timestampSchema.nullable(), resolutionReason: z.string().nullable(),
});
export const proposalDecisionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("APPROVE"), proposalId: id, optionId: id }).strict(),
  z.object({ decision: z.literal("REJECT"), proposalId: id }).strict(),
]);
