"use client";
import { CircleHelp, ArrowDownLeft, ShoppingBag } from "lucide-react";
import { useState } from "react";
import type { Transaction } from "@/domain/models";
import { money, shortDate } from "@/lib/format";
import { classificationOptions } from "@/services/classification";
import { useMutation } from "./useMutation";

export function QuickCheck({ transactions, revision }: { transactions: Transaction[]; revision: number }) {
  const [remember, setRemember] = useState<Record<string, boolean>>({});
  const action = useMutation(revision);
  const visible = transactions;
  if (!visible.length) return null;
  return <section className="card quick-check" aria-labelledby="quick-title">
    <div className="section-heading"><div className="title-with-icon"><CircleHelp size={20} /><h2 id="quick-title">A quick check</h2><span className="count-tag">{visible.length}</span></div><span className="eyebrow">A little context helps</span></div>
    <p className="muted">These transactions could use a second look.</p>
    <div className="review-grid">{visible.map(tx => <div className="review-item" key={tx.id}>
      <div className="review-top"><span className={`icon-tile ${tx.direction === "IN" ? "mint" : "peach"}`}>{tx.direction === "IN" ? <ArrowDownLeft size={20} /> : <ShoppingBag size={20} />}</span><div><strong>{tx.normalizedMerchant}</strong><span className="micro">{shortDate(tx.transactionDate)} · {tx.direction === "IN" ? "Money received" : "Purchase"}</span></div><strong className={tx.direction === "IN" ? "positive amount" : "amount"}>{tx.direction === "IN" ? "+" : "−"}{money(tx.amountCents, tx.currency)}</strong></div>
      <p>{tx.direction === "IN" ? "What was this for?" : "Where should this go?"}</p>
      <div className="choice-row">{classificationOptions(tx.direction).map(option => <button key={option} disabled={action.pending} onClick={() => action.submit({ type: "CLASSIFY", transactionId: tx.id, category: option, remember: remember[tx.id] ?? false })}>{option}</button>)}</div>
      <label className="remember-option"><input type="checkbox" checked={remember[tx.id] ?? false} onChange={event => setRemember(values => ({ ...values, [tx.id]: event.target.checked }))} disabled={action.pending} /> Remember {tx.normalizedMerchant} for similar future transactions</label>
    </div>)}</div>
    <p className="action-message" role="status">{action.pending ? "Saving your category…" : action.message}</p>
  </section>;
}
