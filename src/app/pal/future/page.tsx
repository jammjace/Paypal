import { redirect } from "next/navigation";
import { currentContext } from "@/server/context";
import { readFuture } from "@/services/future";
import { projectFuture, simulateChange } from "@/finance/future";
import { WorkspaceShell } from "@/components/pal/WorkspaceShell";
import { FutureForm, ProjectionView, ScenarioCard } from "@/components/pal/FutureYou";
export default async function FuturePage() {
  const context = await currentContext();
  if (!context) redirect("/pal");
  const state = await readFuture(context.repository, context.userId);
  const buckets = state.buckets.filter(b => b.status === "ACTIVE");
  return <WorkspaceShell title="Future You">
    <p className="muted">A projection from your {state.asOf.slice(0, 10)} snapshot, not a forecast of guaranteed income or spending.</p>
    <section className="card proposal-review"><h2>Projection assumptions</h2><p>Only events you explicitly plan below are included. Everyday spending, interest and unplanned income are not inferred. Spending-budget limits are not scheduled expenses.</p><p>Monthly savings contributions are simulated at the end of the first UTC day of each next month, in priority order, limited by available Safe to Spend and the goal target. They are never executed automatically. Monthly event dates stay anchored to their original day, clamped to shorter months. These projections include the rest of this month and the next 12 calendar months.</p>
      <ProjectionView projection={projectFuture(state)} label="Current saved plan" />
    </section>
    <section className="card proposal-form"><h2>Explore a what-if</h2><p>Preview a contribution plan, planned event, or a budget allowance for this period. Apply saves only the explicit changes shown; discard leaves your plan unchanged.</p><FutureForm buckets={buckets} events={state.recurringEvents} /></section>
    {[...state.futureScenarios].reverse().map(scenario => <ScenarioCard key={scenario.id} scenario={scenario} buckets={buckets} events={state.recurringEvents} projection={scenario.status === "PENDING" ? projectFuture(simulateChange(state, scenario.request).next) : null} />)}
  </WorkspaceShell>;
}
