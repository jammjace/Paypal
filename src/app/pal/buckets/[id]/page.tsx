import { BucketProgress } from "@/components/pal/BucketProgress";
import { bucketProgress } from "@/finance/buckets";
import { notFound, redirect } from "next/navigation";
import { currentContext } from "@/server/context";
import { WorkspaceShell } from "@/components/pal/WorkspaceShell";
import { AllocationForm, ArchiveBucket, BucketEditor } from "@/components/pal/BucketForms";

export default async function BucketPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await currentContext();
  if (!context) redirect("/pal");
  const state = await context.repository.read(context.userId);
  const { id } = await params;
  const selected = state.buckets.find(b => b.id === id && b.status === "ACTIVE");
  if (!selected) notFound();
  return <WorkspaceShell title={selected.name}><BucketProgress bucket={selected} progress={bucketProgress(selected, state.transactions, state.asOf)} /><div className="bucket-detail-grid"><section className="card form-card"><h2>Bucket details</h2><BucketEditor key={`${selected.id}-${state.revision}`} bucket={selected} revision={state.revision} /></section><section className="card form-card"><h2>{selected.type === "GOAL" ? "Add or withdraw savings" : "Manage budget"}</h2>{selected.type === "GOAL" && <AllocationForm key={`${selected.id}-${state.revision}`} bucket={selected} buckets={state.buckets} balanceCents={state.account.currentBalanceCents} revision={state.revision} />}<ArchiveBucket bucket={selected} revision={state.revision} /></section></div></WorkspaceShell>;
}
