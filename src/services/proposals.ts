import { createHash, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import type { Workspace, ProposedAction } from "@/domain/workspace";
import { proposalDecisionSchema, reallocationRequestSchema, type ReallocationRequest } from "@/domain/proposals";
import { reallocationOptions } from "@/finance/reallocation";
import type { MutablePalRepository } from "@/repositories/MutablePalRepository";
import { applyAllocation, recordEvent } from "./mutations";

export class ProposalError extends Error {}
export const PROPOSAL_TTL_MS = 15 * 60 * 1000;
/** Financial state, not workspace revision: unrelated proposal writes do not invalidate previews. */
export function moneyFingerprint(state: Workspace): string {
  return createHash("sha256").update(JSON.stringify({ accountId: state.account.id, userId: state.user.id,
    balance: state.account.currentBalanceCents, asOf: state.asOf,
    buckets: [...state.buckets].sort((a, b) => a.id.localeCompare(b.id)) })).digest("hex");
}
function expirationReason(state: Workspace, proposal: ProposedAction, now: Date): string | null {
  if (!proposal.reallocation) return "This older preview cannot be approved. Create a new one.";
  if (now.getTime() >= new Date(proposal.reallocation.expiresAt).getTime()) return "This preview expired after 15 minutes. Create a new preview.";
  if (proposal.reallocation.fingerprint !== moneyFingerprint(state)) return "Your money picture changed. Create a new preview before approving.";
  return null;
}
function expire(state: Workspace, proposal: ProposedAction, reason: string, now: Date) {
  proposal.status = "EXPIRED";
  if (proposal.reallocation) { proposal.reallocation.resolvedAt = now.toISOString(); proposal.reallocation.resolutionReason = reason; }
  recordEvent(state, "PROPOSAL", `Preview ${proposal.id.slice(0, 8)} expired: ${reason}`, now.toISOString());
}
export async function createProposal(repository: MutablePalRepository, userId: string, input: ReallocationRequest, requestId: string, expectedFingerprint: string, now = new Date()) {
  const request = reallocationRequestSchema.parse(input);
  z.string().uuid().parse(requestId);
  return repository.transact(userId, state => {
    const existing = state.proposedActions.find(p => p.reallocation?.requestId === requestId);
    if (existing) {
      if (JSON.stringify(existing.payloadJson) !== JSON.stringify(request)) throw new ProposalError("This request ID belongs to a different preview.");
      return existing;
    }
    if (moneyFingerprint(state) !== expectedFingerprint) throw new ProposalError("Your money picture changed while interpreting the request. Ask again for a fresh preview.");
    let options;
    try { options = reallocationOptions(state.account.currentBalanceCents, state.buckets, request, userId); }
    catch (error) { throw new ProposalError(error instanceof Error ? error.message : "Unable to preview this request."); }
    const proposal: ProposedAction = { id: randomUUID(), userId, type: "SAVINGS_REALLOCATION", payloadJson: request, impactJson: {}, status: "PENDING", createdAt: now.toISOString(),
      reallocation: { requestId, fingerprint: moneyFingerprint(state), expiresAt: new Date(now.getTime() + PROPOSAL_TTL_MS).toISOString(), options,
        selectedOptionId: null, resolvedAt: null, resolutionReason: null } };
    state.proposedActions.push(proposal);
    recordEvent(state, "PROPOSAL", `Preview ${proposal.id.slice(0, 8)} created. No money moved.`, now.toISOString(), request.destinationBucketId);
    return proposal;
  });
}
/** Approval status, allocations and audit events share one transaction. */
export async function resolveProposal(repository: MutablePalRepository, userId: string, input: unknown, now = new Date()) {
  const decision = proposalDecisionSchema.parse(input);
  return repository.transact(userId, state => {
    const proposal = state.proposedActions.find(p => p.id === decision.proposalId && p.type === "SAVINGS_REALLOCATION" && p.reallocation);
    if (!proposal?.reallocation) throw new ProposalError("Preview not found.");
    const details = proposal.reallocation;
    if (proposal.status === "APPROVED") {
      if (decision.decision === "APPROVE" && decision.optionId === details.selectedOptionId) return { ok: true, message: "This option was already approved. No money moved again." };
      throw new ProposalError("This preview was already approved; another option cannot be applied.");
    }
    if (proposal.status === "REJECTED") {
      if (decision.decision === "REJECT") return { ok: true, message: "This preview was already rejected." };
      throw new ProposalError("This preview was rejected. Create a new preview.");
    }
    if (proposal.status === "EXPIRED") return { ok: false, message: details.resolutionReason ?? "This preview expired." };
    const reason = expirationReason(state, proposal, now);
    if (reason) { expire(state, proposal, reason, now); return { ok: false, message: reason }; }
    if (decision.decision === "REJECT") {
      proposal.status = "REJECTED"; details.resolvedAt = now.toISOString(); details.resolutionReason = "Rejected by you. No money moved.";
      recordEvent(state, "PROPOSAL", `Preview ${proposal.id.slice(0, 8)} rejected. No money moved.`, now.toISOString());
      return { ok: true, message: "Preview rejected. No money moved." };
    }
    const option = details.options.find(o => o.id === decision.optionId);
    if (!option) throw new ProposalError("Choose an option from this preview.");
    const request = reallocationRequestSchema.parse(proposal.payloadJson);
    const fresh = reallocationOptions(state.account.currentBalanceCents, state.buckets, request, userId).find(o => o.id === option.id);
    if (!fresh || !isDeepStrictEqual(fresh, option)) {
      const message = "The impact preview changed. Create a new preview.";
      expire(state, proposal, message, now); return { ok: false, message };
    }
    applyAllocation(state, fresh.changes, `Approved preview ${proposal.id.slice(0, 8)}: ${fresh.title}`, now.toISOString());
    proposal.status = "APPROVED"; details.selectedOptionId = option.id; details.resolvedAt = now.toISOString(); details.resolutionReason = "Approved by you.";
    recordEvent(state, "PROPOSAL", `Preview ${proposal.id.slice(0, 8)} approved: ${fresh.title}`, now.toISOString(), request.destinationBucketId);
    return { ok: true, message: "Approved. Savings updated; your total account balance is unchanged." };
  });
}
/** Lazy, durable expiry on review-page reads. Approval also always checks the clock. */
export async function refreshProposals(repository: MutablePalRepository, userId: string, now = new Date()) {
  await repository.transact(userId, state => {
    for (const proposal of state.proposedActions.filter(p => p.status === "PENDING" && p.type === "SAVINGS_REALLOCATION")) {
      const reason = expirationReason(state, proposal, now);
      if (reason) expire(state, proposal, reason, now);
    }
  });
  return repository.read(userId);
}
