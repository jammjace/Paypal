import { randomUUID } from "node:crypto";
import { z } from "zod";
import { categorySchema, centsSchema } from "@/domain/models";
import { bucketFieldsSchema } from "@/domain/workspace";
import { applyAllocation as allocate, recordEvent as event } from "./mutations";
import type { MutablePalRepository } from "@/repositories/MutablePalRepository";
import { classificationOptions, merchantPattern } from "./classification";

const id = z.string().min(1).max(200);
const amount = centsSchema.refine(value => value > 0);
const fields = bucketFieldsSchema.omit({ type: true }).extend({ bucketType: bucketFieldsSchema.shape.type }).shape;
export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("CREATE_BUCKET"), ...fields, initialAmountCents: centsSchema.refine(value => value >= 0) }).strict(),
  z.object({ type: z.literal("EDIT_BUCKET"), bucketId: id, ...fields }).strict(),
  z.object({ type: z.literal("ARCHIVE_BUCKET"), bucketId: id }).strict(),
  z.object({ type: z.literal("ALLOCATE"), fromBucketId: id.nullable(), toBucketId: id.nullable(), amountCents: amount }).strict(),
  z.object({ type: z.literal("CLASSIFY"), transactionId: id, category: categorySchema, remember: z.boolean() }).strict(),
]);
export type PalCommand = z.infer<typeof commandSchema>;
export const mutationSchema = z.object({ command: commandSchema, revision: z.number().int().nonnegative(), requestId: z.string().uuid() }).strict();
export type Mutation = z.infer<typeof mutationSchema>;
export class CommandError extends Error {}

/** Validation, mutation, idempotency receipt and audit trail share one commit. */
export async function executeCommand(repository: MutablePalRepository, userId: string, input: unknown): Promise<string> {
  const mutation = mutationSchema.parse(input);
  return repository.transact(userId, state => {
    const serialized = JSON.stringify(mutation.command);
    const receipt = state.receipts.find(item => item.requestId === mutation.requestId);
    if (receipt) {
      if (receipt.command !== serialized) throw new CommandError("This request was already used for a different change.");
      return receipt.message;
    }
    if (state.revision !== mutation.revision) throw new CommandError("Your money picture changed. Refresh and review before saving.");
    const command = mutation.command, at = new Date().toISOString();
    if (command.type === "CREATE_BUCKET" || command.type === "EDIT_BUCKET") {
      if (command.bucketType === "SPENDING") {
        if (!classificationOptions("OUT").includes(command.category as never) || command.targetAmountCents <= 0) throw new CommandError("Choose a spending category and a positive budget limit.");
        if ((command.monthlyContributionCents ?? 0) !== 0 || (command.type === "CREATE_BUCKET" && command.initialAmountCents !== 0)) throw new CommandError("Spending budgets track limits and cannot hold savings.");
        if (state.buckets.some(b => b.status === "ACTIVE" && b.type === "SPENDING" && b.category === command.category && (command.type !== "EDIT_BUCKET" || b.id !== command.bucketId))) throw new CommandError("This category already has an active spending budget.");
      }
      if (command.type === "EDIT_BUCKET") {
        const existing = state.buckets.find(b => b.id === command.bucketId);
        if (existing && existing.type !== command.bucketType) throw new CommandError("Archive this bucket and create the other type to keep its history clear.");
      }
    }
    let message: string;
    switch (command.type) {
      case "CREATE_BUCKET": {
        if (state.buckets.some(b => b.status === "ACTIVE" && b.name.toLowerCase() === command.name.toLowerCase())) throw new CommandError("An active bucket already has that name.");
        const bucketId = randomUUID();
        state.buckets.push({ ...bucketFieldsSchema.parse({ ...command, type: command.bucketType }), id: bucketId, userId, status: "ACTIVE", allocatedAmountCents: 0 });
        event(state, "BUCKET_CREATED", `${command.name} bucket created`, at, bucketId);
        if (command.initialAmountCents > 0) allocate(state, [{ bucketId, deltaCents: command.initialAmountCents }], `Added to ${command.name}`, at);
        message = `${command.name} created.`;
        break;
      }
      case "EDIT_BUCKET": {
        const bucket = state.buckets.find(b => b.id === command.bucketId && b.status === "ACTIVE");
        if (!bucket) throw new CommandError("Bucket not found.");
        if (state.buckets.some(b => b.id !== bucket.id && b.status === "ACTIVE" && b.name.toLowerCase() === command.name.toLowerCase())) throw new CommandError("An active bucket already has that name.");
        if (bucket.type === "SPENDING" && (bucket.targetAmountCents !== command.targetAmountCents || bucket.budgetPeriod !== command.budgetPeriod || bucket.category !== command.category)) delete bucket.limitOverride;
        Object.assign(bucket, bucketFieldsSchema.parse({ ...command, type: command.bucketType }));
        event(state, "BUCKET_EDITED", `${bucket.name} details updated`, at, bucket.id);
        message = "Bucket details saved.";
        break;
      }
      case "ARCHIVE_BUCKET": {
        const bucket = state.buckets.find(b => b.id === command.bucketId && b.status === "ACTIVE");
        if (!bucket) throw new CommandError("Bucket not found.");
        if (bucket.allocatedAmountCents > 0) allocate(state, [{ bucketId: bucket.id, deltaCents: -bucket.allocatedAmountCents }], `Released earmarks from ${bucket.name}`, at);
        state.buckets.find(b => b.id === bucket.id)!.status = "ARCHIVED";
        state.allocationRules = state.allocationRules.filter(rule => rule.bucketId !== bucket.id);
        event(state, "BUCKET_ARCHIVED", `${bucket.name} archived`, at, bucket.id);
        message = "Bucket archived; its earmarks were released.";
        break;
      }
      case "ALLOCATE": {
        if (command.fromBucketId === command.toBucketId) throw new CommandError("Choose different source and destination.");
        const label = (id: string | null) => id === null ? "Safe to Spend" : state.buckets.find(b => b.id === id && b.status === "ACTIVE")?.name;
        const from = label(command.fromBucketId), to = label(command.toBucketId);
        if (!from || !to) throw new CommandError("Bucket not found.");
        const changes = [];
        if (command.fromBucketId) changes.push({ bucketId: command.fromBucketId, deltaCents: -command.amountCents });
        if (command.toBucketId) changes.push({ bucketId: command.toBucketId, deltaCents: command.amountCents });
        allocate(state, changes, `${from} → ${to}`, at);
        message = "Earmarks updated. Your total balance is unchanged.";
        break;
      }
      case "CLASSIFY": {
        const transaction = state.transactions.find(tx => tx.id === command.transactionId && tx.status === "COMPLETED");
        if (!transaction) throw new CommandError("Transaction not found.");
        if (!classificationOptions(transaction.direction).includes(command.category)) throw new CommandError("Choose a category for this transaction direction.");
        transaction.category = command.category;
        transaction.categorizationConfidence = 1;
        transaction.categorizationSource = "USER";
        transaction.needsReview = false;
        if (command.remember) {
          const pattern = merchantPattern(transaction.normalizedMerchant);
          const existing = state.merchantRules.find(rule => rule.merchantPattern === pattern && rule.direction === transaction.direction && rule.transactionType === transaction.transactionType);
          const rule = { id: existing?.id ?? randomUUID(), userId, merchantPattern: pattern, normalizedMerchant: transaction.normalizedMerchant,
            category: command.category, confidence: 1, learnedFromUser: true, direction: transaction.direction, transactionType: transaction.transactionType };
          if (existing) Object.assign(existing, rule); else state.merchantRules.push(rule);
        }
        event(state, "CATEGORIZATION", `${transaction.normalizedMerchant} categorized as ${command.category}`, at, null, transaction.id);
        message = command.remember ? "Category saved. Similar future transactions will use this rule." : "Category saved.";
        break;
      }
    }
    state.receipts.push({ requestId: mutation.requestId, command: serialized, message });
    return message;
  });
}
