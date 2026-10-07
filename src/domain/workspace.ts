import { reallocationDetailsSchema } from "./proposals";
import { recurringEventSchema, scenarioSchema, clarificationSchema } from "./future";
import { z } from "zod";
import { accountSchema, categorySchema, centsSchema, timestampSchema, transactionSchema, type PalSnapshot } from "./models";

const id = z.string().min(1).max(200);
const nonnegative = centsSchema.refine(value => value >= 0);
export const bucketFieldsSchema = z.object({
  name: z.string().trim().min(1).max(60), category: z.string().trim().min(1).max(60),
  type: z.enum(["SPENDING", "GOAL"]),
  budgetPeriod: z.enum(["WEEKLY", "MONTHLY"]).optional(), monthlyContributionCents: nonnegative.optional(),
  targetAmountCents: nonnegative, targetDate: timestampSchema.nullable(),
  recurrence: z.enum(["MONTHLY"]).nullable(), priority: z.number().int().min(1).max(10),
});
export const bucketSchema = bucketFieldsSchema.extend({ id, userId: id, allocatedAmountCents: nonnegative, status: z.enum(["ACTIVE", "ARCHIVED"]), limitOverride: z.object({ amountCents: nonnegative, from: timestampSchema, to: timestampSchema }).optional() });
export const merchantRuleSchema = z.object({
  id, userId: id, merchantPattern: z.string(), normalizedMerchant: z.string(), category: categorySchema,
  confidence: z.number().min(0).max(1), learnedFromUser: z.boolean(),
  direction: z.enum(["IN", "OUT"]), transactionType: transactionSchema.shape.transactionType,
});
export type MerchantRule = z.infer<typeof merchantRuleSchema>;
export const palEventSchema = z.object({
  id, userId: id, kind: z.enum(["ALLOCATION", "BUCKET_CREATED", "BUCKET_EDITED", "BUCKET_ARCHIVED", "CATEGORIZATION", "SYNC", "PROPOSAL"]),
  bucketId: id.nullable(), transactionId: id.nullable(), deltaCents: centsSchema.nullable(),
  reason: z.string(), createdAt: timestampSchema,
});
export type PalEvent = z.infer<typeof palEventSchema>;
export const workspaceSchema = z.object({
  schemaVersion: z.literal(2), revision: z.number().int().nonnegative(),
  recurringEvents: z.array(recurringEventSchema).default([]),
  futureScenarios: z.array(scenarioSchema).default([]),
  clarifications: z.array(clarificationSchema).default([]),
  user: z.object({ id, name: z.string(), currency: z.literal("USD"), createdAt: timestampSchema }),
  account: accountSchema, transactions: z.array(transactionSchema), asOf: timestampSchema,
  buckets: z.array(bucketSchema),
  activity: z.array(z.object({ id, userId: id, bucketId: id, deltaCents: centsSchema, previousAmountCents: nonnegative, newAmountCents: nonnegative, reason: z.string(), createdAt: timestampSchema })),
  events: z.array(palEventSchema), merchantRules: z.array(merchantRuleSchema),
  transactionAllocations: z.array(z.object({ id, transactionId: id, bucketId: id, amountCents: nonnegative })),
  allocationRules: z.array(z.object({ id, userId: id, bucketId: id, triggerType: z.enum(["INCOME", "SCHEDULE"]), amountType: z.enum(["FIXED", "BASIS_POINTS"]), amountValue: nonnegative, priority: z.number().int() })),
  proposedActions: z.array(z.object({ reallocation: reallocationDetailsSchema.optional(), id, userId: id, type: z.string(), payloadJson: z.record(z.string(), z.unknown()), impactJson: z.record(z.string(), z.unknown()), status: z.enum(["PENDING", "APPROVED", "REJECTED", "EXPIRED"]), createdAt: timestampSchema })),
  conversations: z.array(z.object({ id, userId: id, createdAt: timestampSchema })),
  receipts: z.array(z.object({ requestId: id, command: z.string(), message: z.string() })),
  syncWindow: z.object({ from: timestampSchema, to: timestampSchema }).nullable(),
});
export type Workspace = z.infer<typeof workspaceSchema>;
export type TransactionAllocation = Workspace["transactionAllocations"][number];
export type AllocationRule = Workspace["allocationRules"][number];
export type ProposedAction = Workspace["proposedActions"][number];
export type Conversation = Workspace["conversations"][number];

export function workspaceFromSnapshot(snapshot: PalSnapshot): Workspace {
  return workspaceSchema.parse({ ...snapshot, schemaVersion: 2, revision: 0, merchantRules: [],
    events: [...snapshot.activity].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(event => ({ ...event, kind: "ALLOCATION", transactionId: null })),
    transactionAllocations: [], allocationRules: [], proposedActions: [], conversations: [], receipts: [], syncWindow: null });
}
