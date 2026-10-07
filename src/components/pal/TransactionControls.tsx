"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncAction } from "@/server/actions";
import { useMutation } from "./useMutation";
import { classificationOptions } from "@/services/classification";
import type { Category, Transaction } from "@/domain/models";

export function SyncTransactions() {
  const [pending, start] = useTransition(), [message, setMessage] = useState("");
  const router = useRouter();
  return <div className="sync-control"><button className="subtle-button" disabled={pending} onClick={() => start(async () => {
    try { const result = await syncAction(); setMessage(result.message); if (result.ok) router.refresh(); }
    catch { setMessage("Could not sync. Your saved data is unchanged."); }
  })}>{pending ? "Syncing…" : "Sync transactions"}</button><p className="action-message" role="status">{message}</p></div>;
}
export function EditTransaction({ transaction, revision }: { transaction: Transaction; revision: number }) {
  const action = useMutation(revision);
  return <details className="transaction-editor"><summary>Edit category</summary><form onSubmit={e => {
    e.preventDefault(); const form = new FormData(e.currentTarget);
    action.submit({ type: "CLASSIFY", transactionId: transaction.id, category: String(form.get("category")) as Category, remember: form.get("remember") === "on" });
  }}><label>Category<select name="category" defaultValue={transaction.category} disabled={action.pending}>{transaction.category === "Uncategorized" && <option value="Uncategorized" disabled>Choose a category</option>}{classificationOptions(transaction.direction).map(category => <option key={category}>{category}</option>)}</select></label><label className="remember-option"><input type="checkbox" name="remember" /> Remember for similar future transactions</label><button className="subtle-button" disabled={action.pending}>Save category</button><p role="status">{action.message}</p></form></details>;
}
