import { CircleHelp, ArrowDownLeft, ShoppingBag } from "lucide-react";
import type { Transaction } from "@/domain/models";
import { money, shortDate } from "@/lib/format";

export function QuickCheck({ transactions }: { transactions: Transaction[] }) {
  if (!transactions.length) return null;
  return <section className="card quick-check" aria-labelledby="quick-title">
    <div className="section-heading"><div className="title-with-icon"><CircleHelp size={20} /><h2 id="quick-title">A quick check</h2><span className="count-tag">{transactions.length}</span></div><span className="eyebrow">A little context helps</span></div>
    <p className="muted">These transactions could use a second look.</p>
    <div className="review-grid">{transactions.map(tx => <div className="review-item" key={tx.id}>
      <div className="review-top"><span className={`icon-tile ${tx.direction === "IN" ? "mint" : "peach"}`}>{tx.direction === "IN" ? <ArrowDownLeft size={20} /> : <ShoppingBag size={20} />}</span><div><strong>{tx.normalizedMerchant}</strong><span className="micro">{shortDate(tx.transactionDate)} · {tx.direction === "IN" ? "Money received" : "Purchase"}</span></div><strong className={tx.direction === "IN" ? "positive amount" : "amount"}>{tx.direction === "IN" ? "+" : "−"}{money(tx.amountCents, tx.currency)}</strong></div>
      <p>{tx.direction === "IN" ? "What was this for?" : "Where should this go?"}</p>
      <div className="choice-row">{(tx.direction === "IN" ? ["Reimbursement", "Gift", "Income", "Transfer", "Other"] : ["Groceries", "Shopping", "Household", "Other"]).map(option => <button key={option} disabled title="Categorization will be available in a later milestone">{option}</button>)}</div>
    </div>)}</div>
    <p className="preview-note">Categorization is shown as a preview. No changes can be saved yet.</p>
  </section>;
}
