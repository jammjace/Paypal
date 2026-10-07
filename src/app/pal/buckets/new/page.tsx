import { redirect } from "next/navigation";
import { currentContext } from "@/server/context";
import { WorkspaceShell } from "@/components/pal/WorkspaceShell";
import { BucketEditor } from "@/components/pal/BucketForms";
export default async function NewBucketPage() {
  const context = await currentContext();
  if (!context) redirect("/pal");
  const state = await context.repository.read(context.userId);
  return <WorkspaceShell title="Create a bucket"><section className="card form-card"><BucketEditor revision={state.revision} /></section></WorkspaceShell>;
}
