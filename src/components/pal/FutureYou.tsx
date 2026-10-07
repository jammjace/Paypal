"use client";
import { useState, useTransition } from "react";
import type { Bucket } from "@/domain/models";
import type { RecurringEvent, FutureScenario, ScenarioRequest } from "@/domain/future";
import type { projectFuture } from "@/finance/future";
import { previewFutureAction, decideFutureAction } from "@/server/actions";
import { money, shortDate } from "@/lib/format";
import { moneyInput, parseMoneyInput } from "@/lib/money-input";

export function FutureForm({ buckets, events, initial, replaceId }: { buckets: Bucket[]; events: RecurringEvent[]; initial?: ScenarioRequest; replaceId?: string }) {
  const [kind, setKind] = useState<ScenarioRequest["kind"]>(initial?.kind ?? "CONTRIBUTION");
  const [pending, start] = useTransition(), [message, setMessage] = useState("");
  const goals = buckets.filter(b => b.type === "GOAL"), budgets = buckets.filter(b => b.type === "SPENDING");
  const initialAmount = initial?.kind === "CONTRIBUTION" ? initial.monthlyCents : initial?.kind === "BUDGET" ? initial.increaseCents : initial?.kind === "EVENT" ? initial.event.amountCents : 0;
  return <form className="editor-form future-form" onSubmit={e => {
    e.preventDefault(); const data = new FormData(e.currentTarget); setMessage("");
    start(async () => {
      try {
        let request: ScenarioRequest;
        if (kind === "BUDGET") request = { kind, bucketId: String(data.get("bucket")), increaseCents: parseMoneyInput(String(data.get("amount"))), sourceGoalId: String(data.get("source")) || null };
        else if (kind === "CONTRIBUTION") request = { kind, bucketId: String(data.get("bucket")), monthlyCents: parseMoneyInput(String(data.get("amount"))) };
        else if (kind === "EVENT") request = { kind, event: { id: crypto.randomUUID(), name: String(data.get("name")), amountCents: parseMoneyInput(String(data.get("amount"))), direction: data.get("direction") as "IN" | "OUT", recurrence: data.get("recurrence") as "ONCE" | "MONTHLY", startDate: `${data.get("date")}T12:00:00.000Z` } };
        else request = { kind, eventId: String(data.get("eventId")) };
        const result = await previewFutureAction({ request, requestId: crypto.randomUUID(), ...(replaceId ? { replaceId } : {}) });
        setMessage(result.message);
      } catch { setMessage("Check the amount and date. Use dollars with at most two decimal places."); }
    });
  }}>
    <fieldset disabled={pending}>
      <label>Change type<select value={kind} onChange={e => setKind(e.target.value as ScenarioRequest["kind"])}><option value="CONTRIBUTION">Monthly savings plan</option><option value="BUDGET">This period's spending allowance</option><option value="EVENT">Planned income or expense</option><option value="REMOVE_EVENT">Remove a planned event</option></select></label>
      {(kind === "BUDGET" || kind === "CONTRIBUTION") && <label>Bucket<select name="bucket" key={kind} defaultValue={initial && "bucketId" in initial ? initial.bucketId : undefined} required>{(kind === "BUDGET" ? budgets : goals).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}
      {kind !== "REMOVE_EVENT" && <label>{kind === "BUDGET" ? "Increase allowance by (USD)" : kind === "CONTRIBUTION" ? "New monthly contribution (USD)" : "Event amount (USD)"}<input name="amount" required inputMode="decimal" defaultValue={moneyInput(initialAmount)} /></label>}
      {kind === "BUDGET" && <label>Savings withdrawal<select name="source" defaultValue={initial?.kind === "BUDGET" ? initial.sourceGoalId ?? "" : ""}><option value="">None — increase limit only</option>{goals.map(g => <option value={g.id} key={g.id}>Also withdraw from {g.name}</option>)}</select></label>}
      {kind === "EVENT" && <><label>Event name<input name="name" required maxLength={60} defaultValue={initial?.kind === "EVENT" ? initial.event.name : ""} /></label><label>Direction<select name="direction" defaultValue={initial?.kind === "EVENT" ? initial.event.direction : "OUT"}><option value="OUT">Expense</option><option value="IN">Income</option></select></label><label>First date (UTC)<input name="date" type="date" required defaultValue={initial?.kind === "EVENT" ? initial.event.startDate.slice(0, 10) : undefined} /></label><label>Repeat<select name="recurrence" defaultValue={initial?.kind === "EVENT" ? initial.event.recurrence : "MONTHLY"}><option value="MONTHLY">Monthly</option><option value="ONCE">Once</option></select></label></>}
      {kind === "REMOVE_EVENT" && <label>Planned event<select name="eventId" required defaultValue={initial?.kind === "REMOVE_EVENT" ? initial.eventId : undefined}>{events.map(event => <option key={event.id} value={event.id}>{event.name}</option>)}</select></label>}
      <button className="primary-button">{pending ? "Calculating…" : replaceId ? "Preview modified scenario" : "Preview scenario"}</button>
    </fieldset><p role="status">{message}</p>
  </form>;
}

export function ProjectionView({ projection, label }: { projection: ReturnType<typeof projectFuture>; label: string }) {
  return <div className="projection-view"><h3>{label}</h3><p>Projected account balance: <strong>{money(projection.final.balanceCents)}</strong> · Projected Safe to Spend: <strong>{money(projection.final.safeToSpendCents)}</strong></p>
    <ul>{projection.goals.map(goal => <li key={goal.id}><strong>{goal.name}</strong>: {money(goal.projectedCents)} projected savings. {goal.targetCents > 0 ? goal.fundedAt ? `Target reached ${goal.fundedAt.slice(0, 10)}${goal.onTime === false ? " (after your target date)" : ""}.` : "Target not reached within this horizon." : "No total savings target."}</li>)}</ul>
    <details><summary>Projected events ({projection.timeline.length})</summary><div className="future-events">{projection.timeline.map((event, i) => <div key={i} className="future-event"><strong>{shortDate(event.date)}, {new Date(event.date).getUTCFullYear()} · {event.name}</strong><p>{event.direction === "SAVE" ? "Hypothetical savings contribution" : event.direction === "IN" ? "Planned income" : "Planned expense"}: {money(event.appliedCents)} · Safe to Spend {money(event.safeToSpendCents)}</p>{event.shortfallCents > 0 && <p className="future-warning">{money(event.shortfallCents)} of the planned contribution cannot be funded.</p>}{event.safeToSpendCents < 0 && <p className="future-warning">Projected shortfall: planned spending exceeds unreserved funds.</p>}</div>)}</div></details>
  </div>;
}

export function ScenarioCard({ scenario, projection, buckets, events }: { scenario: FutureScenario; projection: ReturnType<typeof projectFuture> | null; buckets: Bucket[]; events: RecurringEvent[] }) {
  const [pending, start] = useTransition(), [message, setMessage] = useState("");
  function decide(decision: "APPLY" | "DISCARD") { start(async () => { try { setMessage((await decideFutureAction({ id: scenario.id, decision })).message); } catch { setMessage("Unable to save. Refresh to check the status before retrying."); } }); }
  return <section className="card proposal-review" id={`scenario-${scenario.id}`} aria-label={`What-if scenario ${scenario.id.slice(0, 8)}`}><h2>{scenario.request.kind === "BUDGET" ? "Budget change" : "What-if scenario"} <small>{scenario.id.slice(0, 8)}</small></h2>
    <p><strong>{scenario.status}</strong> · {scenario.message}</p>
    {scenario.status === "PENDING" && <p className="micro">Expires {scenario.expiresAt.slice(0, 19).replace("T", " ")} UTC.</p>}
    <ul className="scenario-effects">{scenario.effects.map(effect => <li key={effect}>{effect}</li>)}</ul>
    {projection && <ProjectionView projection={projection} label="If applied: projected next 12 calendar months" />}
    {scenario.status === "PENDING" && <div className="scenario-controls"><button className="primary-button" disabled={pending} onClick={() => decide("APPLY")}>Approve and apply</button><button className="subtle-button" disabled={pending} onClick={() => decide("DISCARD")}>Discard scenario</button></div>}
    {(scenario.status === "PENDING" || scenario.status === "EXPIRED") && <details><summary>Modify scenario</summary><FutureForm buckets={buckets} events={events} initial={scenario.request} replaceId={scenario.id} /></details>}
    <p role="status">{message}</p>
  </section>;
}
