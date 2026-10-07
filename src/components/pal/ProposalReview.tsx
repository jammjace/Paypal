"use client";
import { useState, useTransition } from "react";
import type { Bucket } from "@/domain/models";
import type { ProposedAction } from "@/domain/workspace";
import { decideProposalAction, previewSavingsAction } from "@/server/actions";
import { money } from "@/lib/format";
import { parseMoneyInput } from "@/lib/money-input";

export function SavingsPreviewForm({ goals }: { goals: Bucket[] }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  return <form className="card editor-form proposal-form" onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setMessage("");
    start(async () => {
      try {
        const source = String(data.get("source"));
        const result = await previewSavingsAction({ requestId: crypto.randomUUID(), request: {
          destinationBucketId: data.get("destination") || null,
          funding: source === "AUTO" || source === "SAFE_TO_SPEND" ? source : "GOAL",
          sourceBucketId: source === "AUTO" || source === "SAFE_TO_SPEND" ? null : source,
          amountCents: parseMoneyInput(String(data.get("amount"))),
        } });
        setMessage(result.message);
      } catch { setMessage("Enter a positive dollar amount with at most two decimal places."); }
    });
  }}>
    <h2>Preview a savings change</h2>
    <p>Compare ways to set money aside or release savings. Each preview lasts 15 minutes. Nothing moves until you approve an option.</p>
    <label>Amount ($)<input name="amount" inputMode="decimal" placeholder="200.00" required disabled={pending} /></label>
    <label htmlFor="preview-destination">Destination</label><select id="preview-destination" name="destination" disabled={pending} defaultValue={goals[0]?.id ?? ""}>{goals.map(g => <option value={g.id} key={g.id}>{g.name}</option>)}<option value="">Safe to Spend (withdraw savings)</option></select>
    <label htmlFor="preview-source">Funding source</label><select id="preview-source" name="source" disabled={pending}><option value="AUTO">Compare available sources</option><option value="SAFE_TO_SPEND">Safe to Spend only</option>{goals.map(g => <option value={g.id} key={g.id}>{g.name}</option>)}</select>
    <p className="micro">For withdrawals, choose the goal to withdraw from. Spending budgets track category limits and cannot fund savings. Monthly contribution plans remain manual.</p>
    <button className="primary-button" disabled={pending}>{pending ? "Preparing preview…" : "Create preview"}</button>
    <p role="status">{message}</p>
  </form>;
}

export function ProposalReview({ proposal }: { proposal: ProposedAction }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const details = proposal.reallocation;
  if (!details) return null;
  function decide(optionId?: string) {
    setMessage("");
    start(async () => {
      try {
        const result = await decideProposalAction(optionId ? { decision: "APPROVE", proposalId: proposal.id, optionId } : { decision: "REJECT", proposalId: proposal.id });
        setMessage(result.message);
      } catch { setMessage("Unable to save your decision. Refresh to check its status before retrying."); }
    });
  }
  return <section className="card proposal-review" id={`proposal-${proposal.id}`} aria-label={`Savings preview ${proposal.id.slice(0, 8)}`}>
    <h2>Savings preview <small>{proposal.id.slice(0, 8)}</small></h2>
    <p><strong>{proposal.status}</strong> · {proposal.status === "PENDING" ? `Expires ${new Date(details.expiresAt).toISOString().replace("T", " ").slice(0, 19)} UTC` : details.resolutionReason}</p>
    <p>Choose one option. These are changes to money set aside in Pal; no payment or bank transfer is made.</p>
    <div className="proposal-options">{details.options.map(option => <article className="proposal-option" key={option.id}>
      <h3>{option.title}{details.selectedOptionId === option.id ? " · Approved" : ""}</h3>
      <p>{option.explanation}</p>
      <dl className="proposal-totals">
        <div><dt>Safe to Spend</dt><dd>{money(option.before.safeToSpendCents)} → {money(option.after.safeToSpendCents)}</dd></div>
        <div><dt>Total savings set aside</dt><dd>{money(option.before.earmarkedCents)} → {money(option.after.earmarkedCents)}</dd></div>
        <div><dt>Account balance</dt><dd>{money(option.before.balanceCents)} → {money(option.after.balanceCents)}</dd></div>
      </dl>
      {option.goals.map(goal => <p key={goal.bucketId}><strong>{goal.name}</strong>: {money(goal.previousAmountCents)} → {money(goal.newAmountCents)} saved{goal.targetAmountCents > 0 && <><br /><span className="micro">Still to save: {money(goal.previousGapCents)} → {money(goal.newGapCents)}</span></>}</p>)}
      {option.warnings.length > 0 && <ul>{option.warnings.map(w => <li key={w}>{w}</li>)}</ul>}
      {proposal.status === "PENDING" && <button className="primary-button" disabled={pending} onClick={() => decide(option.id)}>Approve: {option.title}</button>}
    </article>)}</div>
    {proposal.status === "PENDING" && <button className="subtle-button" disabled={pending} onClick={() => decide()}>Reject this preview</button>}
    <p role="status">{message}</p>
  </section>;
}
