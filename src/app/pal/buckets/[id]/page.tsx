import Link from "next/link";
import { projectFuture } from "@/finance/future";
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
  const projection = projectFuture(state).goals.find(g => g.id === selected.id);
  return <WorkspaceShell title={selected.name}><BucketProgress bucket={selected} progress={bucketProgress(selected, state.transactions, state.asOf)} /><p className="muted">{projection ? projection.fundedAt ? `Conditional projected goal date: ${projection.fundedAt.slice(0, 10)}. Based only on saved plans; contributions are not automatic.` : "This goal is not projected to reach its target within the next 12 calendar months under the saved plan." : "Changing the usual limit, category or period below replaces any temporary allowance adjustment."} <Link className="text-link" href="/pal/future">Explore in Future You</Link></p><div className="bucket-detail-grid"><section className="card form-card"><h2>Bucket details</h2><BucketEditor key={`${selected.id}-${state.revision}`} bucket={selected} revision={state.revision} /></section><section className="card form-card"><h2>{selected.type === "GOAL" ? "Add or withdraw savings" : "Manage budget"}</h2>{selected.type === "GOAL" && <AllocationForm key={`${selected.id}-${state.revision}`} bucket={selected} buckets={state.buckets} balanceCents={state.account.currentBalanceCents} revision={state.revision} />}<ArchiveBucket bucket={selected} revision={state.revision} /></section></div></WorkspaceShell>;
}
