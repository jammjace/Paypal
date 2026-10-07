import { redirect } from "next/navigation";
import { currentContext } from "@/server/context";
import { WorkspaceShell } from "@/components/pal/WorkspaceShell";
import { SyncTransactions, EditTransaction } from "@/components/pal/TransactionControls";
import { money, shortDate } from "@/lib/format";
import { CONFIDENCE } from "@/services/classification";
export default async function TransactionsPage() {
  const context = await currentContext();
  if (!context) redirect("/pal");
  const state = await context.repository.read(context.userId);
  const transactions = [...state.transactions].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  return <WorkspaceShell title="Transactions"><p className="muted">Saved account records. Categorization never moves money between buckets.</p><SyncTransactions /><section className="card transaction-ledger" aria-label="Saved transactions">{transactions.map(tx => <article className="ledger-row" key={tx.id}><div><strong>{tx.normalizedMerchant}</strong><span className="micro">{shortDate(tx.transactionDate)} · {tx.status.toLowerCase()}</span><span className="transaction-category">{tx.category}{tx.needsReview ? " · needs review" : tx.categorizationConfidence < CONFIDENCE.automatic ? " · provisional" : ""}</span></div><strong className="ledger-amount">{tx.direction === "IN" ? "+" : "−"}{money(tx.amountCents)}</strong>{tx.status === "COMPLETED" && <EditTransaction transaction={tx} revision={state.revision} />}</article>)}</section></WorkspaceShell>;
}
