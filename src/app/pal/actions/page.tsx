import { redirect } from "next/navigation";
import { currentContext } from "@/server/context";
import { refreshProposals } from "@/services/proposals";
import { WorkspaceShell } from "@/components/pal/WorkspaceShell";
import { ProposalReview, SavingsPreviewForm } from "@/components/pal/ProposalReview";
export default async function ActionsPage() {
  const context = await currentContext();
  if (!context) redirect("/pal");
  const state = await refreshProposals(context.repository, context.userId);
  const proposals = [...state.proposedActions].reverse().filter(p => p.type === "SAVINGS_REALLOCATION" && p.reallocation);
  return <WorkspaceShell title="Review changes">
    <p className="muted">Savings goals hold money you have set aside. Spending budgets limit category spending over a period; their allowances are not available funding.</p>
    <SavingsPreviewForm goals={state.buckets.filter(b => b.type === "GOAL" && b.status === "ACTIVE")} />
    {proposals.length ? proposals.map(p => <ProposalReview key={p.id} proposal={p} />) : <p>No savings previews yet. Create one above or ask Pal “Add $200 to Travel”.</p>}
  </WorkspaceShell>;
}
