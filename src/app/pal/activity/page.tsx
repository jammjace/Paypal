import { redirect } from "next/navigation";
import { currentContext } from "@/server/context";
import { WorkspaceShell } from "@/components/pal/WorkspaceShell";
import { ActivityFeed } from "@/components/pal/ActivityFeed";
export default async function ActivityPage() {
  const context = await currentContext();
  if (!context) redirect("/pal");
  const state = await context.repository.read(context.userId);
  return <WorkspaceShell title="Pal activity"><p className="muted">A record of your bucket and categorization choices.</p><section className="card activity-card"><ActivityFeed events={[...state.events].reverse()} /></section></WorkspaceShell>;
}
