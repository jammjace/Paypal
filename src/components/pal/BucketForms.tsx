"use client";
import { classificationOptions } from "@/services/classification";
import { useState } from "react";
import type { Bucket } from "@/domain/models";
import { moneyInput, parseMoneyInput } from "@/lib/money-input";
import { money } from "@/lib/format";
import { previewAllocation } from "@/finance/allocations";
import { useMutation } from "./useMutation";

export function BucketEditor({ bucket, revision }: { bucket?: Bucket; revision: number }) {
  const action = useMutation(revision);
  const [kind, setKind] = useState<Bucket["type"]>(bucket?.type ?? "GOAL");
  return <form className="editor-form" onSubmit={event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const fields = { name: String(form.get("name")), category: String(form.get("category")), bucketType: kind,
        budgetPeriod: form.get("period") === "WEEKLY" ? "WEEKLY" as const : "MONTHLY" as const, monthlyContributionCents: kind === "GOAL" ? parseMoneyInput(String(form.get("contribution"))) : 0,
        targetAmountCents: parseMoneyInput(String(form.get("target"))), targetDate: form.get("date") ? `${form.get("date")}T12:00:00.000Z` : null,
        recurrence: form.get("recurrence") === "MONTHLY" ? "MONTHLY" as const : null, priority: Number(form.get("priority")) };
      if (bucket) action.submit({ type: "EDIT_BUCKET", bucketId: bucket.id, ...fields });
      else action.submit({ type: "CREATE_BUCKET", ...fields, initialAmountCents: kind === "GOAL" ? parseMoneyInput(String(form.get("initial"))) : 0 }, () => action.router.push("/pal#buckets"));
    } catch (error) { action.setMessage(error instanceof Error ? error.message : "Check the entered values."); }
  }}>
    <fieldset disabled={action.pending}><legend className="sr-only">Bucket details</legend>
      <label>Bucket name<input name="name" required maxLength={60} defaultValue={bucket?.name ?? ""} /></label>
      <label>Category{kind === "SPENDING" ? <select name="category" defaultValue={bucket?.category ?? "Dining"}>{classificationOptions("OUT").filter(c => c !== "Transfer").map(c => <option key={c}>{c}</option>)}</select> : <input name="category" required maxLength={60} defaultValue={bucket?.category ?? ""} placeholder="e.g. Travel" />}</label>
      <div className="form-grid"><label>Type<select name="type" value={kind} disabled={!!bucket} onChange={e => setKind(e.target.value as Bucket["type"])}><option value="GOAL">Savings goal</option><option value="SPENDING">Spending budget</option></select></label>
      <label>Priority<select name="priority" defaultValue={bucket?.priority ?? 5}>{Array.from({ length: 10 }, (_, i) => <option key={i} value={i + 1}>{i + 1}{i === 0 ? " — highest" : i === 9 ? " — lowest" : ""}</option>)}</select></label></div>
      <label>{kind === "SPENDING" ? "Budget limit (USD)" : "Target amount (USD)"}<input name="target" inputMode="decimal" required defaultValue={moneyInput(bucket?.targetAmountCents ?? 0)} /></label>
      {!bucket && kind === "GOAL" && <label>Initial earmark (USD)<input name="initial" inputMode="decimal" required defaultValue="0.00" /><span className="micro">Taken from Safe to Spend; your total balance stays the same.</span></label>}
      {kind === "SPENDING" ? <label>Budget period<select name="period" defaultValue={bucket?.budgetPeriod ?? "MONTHLY"}><option value="MONTHLY">Calendar month</option><option value="WEEKLY">Calendar week (Monday start)</option></select><span className="micro">Tracks category purchases in UTC. The allowance resets each period; unused allowance does not carry over. A limit does not reserve cash.</span></label> : <>
      <label>Target date<input name="date" type="date" defaultValue={bucket?.targetDate?.slice(0, 10) ?? ""} /></label>
      <label>Monthly contribution (USD)<input name="contribution" inputMode="decimal" defaultValue={moneyInput(bucket?.monthlyContributionCents ?? 0)} /><span className="micro">Your planned monthly addition. Confirm each addition below; money is never moved automatically.</span></label>
      <p className="micro">Savings carry forward. Add money from Safe to Spend, or withdraw it back when you need it. A zero target means open-ended saving.</p></>}
      <button className="primary-button" type="submit">{action.pending ? "Saving…" : bucket ? "Save bucket" : "Create bucket"}</button>
    </fieldset><p className="action-message" role="status">{action.message}</p>
  </form>;
}

export function AllocationForm({ bucket, buckets, balanceCents, revision }: { bucket: Bucket; buckets: Bucket[]; balanceCents: number; revision: number }) {
  const action = useMutation(revision);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(bucket.id);
  const [amount, setAmount] = useState(bucket.monthlyContributionCents ? moneyInput(bucket.monthlyContributionCents) : "");
  let preview: ReturnType<typeof previewAllocation> | null = null;
  let error = "";
  try {
    if (amount) {
      const cents = parseMoneyInput(amount);
      if (from === to || cents === 0) throw new Error("Choose different accounts for earmarks and a positive amount.");
      const changes = [...(from ? [{ bucketId: from, deltaCents: -cents }] : []), ...(to ? [{ bucketId: to, deltaCents: cents }] : [])];
      preview = previewAllocation(balanceCents, buckets, changes, bucket.userId);
    }
  } catch { error = "Check the amount and source. There must be enough earmarked or unearmarked money."; }
  const options = <><option value="">Safe to Spend</option>{buckets.filter(b => b.status === "ACTIVE" && b.type === "GOAL").map(b => <option key={b.id} value={b.id}>{b.name} · {money(b.allocatedAmountCents)}</option>)}</>;
  return <form className="editor-form" onSubmit={event => { event.preventDefault(); if (preview) action.submit({ type: "ALLOCATE", fromBucketId: from || null, toBucketId: to || null, amountCents: parseMoneyInput(amount) }); }}>
    <fieldset disabled={action.pending}><legend className="sr-only">Move earmarks</legend>
      <div className="form-grid"><label>From<select value={from} onChange={e => setFrom(e.target.value)}>{options}</select></label><label>To<select value={to} onChange={e => setTo(e.target.value)}>{options}</select></label></div>
      <label>Amount (USD)<input inputMode="decimal" required value={amount} onChange={e => setAmount(e.target.value)} /></label>
      {preview && <div className="allocation-preview"><strong>After this change</strong><p>Earmarked: {money(preview.after.earmarkedCents)}</p><p>Safe to Spend: {money(preview.after.safeToSpendCents)}</p><p className="micro">Total balance stays {money(balanceCents)}. No money leaves your account.</p></div>}
      {error && <p className="action-message">{error}</p>}
      <button className="primary-button" type="submit" disabled={!preview}>{action.pending ? "Saving…" : "Confirm allocation"}</button>
    </fieldset><p className="action-message" role="status">{action.message}</p>
  </form>;
}

export function ArchiveBucket({ bucket, revision }: { bucket: Bucket; revision: number }) {
  const action = useMutation(revision);
  return <details className="archive-control"><summary>Archive bucket</summary><p>Archive {bucket.name}{bucket.type === "GOAL" ? ` and return ${money(bucket.allocatedAmountCents)} to Safe to Spend` : " and stop tracking this budget"}. Activity history is kept.</p><button className="subtle-button" disabled={action.pending} onClick={() => action.submit({ type: "ARCHIVE_BUCKET", bucketId: bucket.id }, () => action.router.push("/pal#buckets"))}>Confirm archive</button><p role="status">{action.message}</p></details>;
}
