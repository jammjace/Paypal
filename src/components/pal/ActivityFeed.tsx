import type { PalEvent } from "@/domain/workspace";
import { money, shortDate } from "@/lib/format";
export function ActivityFeed({ events }: { events: PalEvent[] }) {
  return <>{events.length === 0 ? <p className="muted">Your bucket and categorization activity will appear here.</p> : events.map(event => <div className="activity-row" key={event.id}><span className="activity-icon" aria-hidden="true">{event.kind === "CATEGORIZATION" ? "✓" : "·"}</span><div><strong>{event.reason}</strong><span className="micro">{shortDate(event.createdAt)} · {event.kind === "CATEGORIZATION" ? "Transaction category" : "Bucket activity"}</span></div>{event.deltaCents !== null && <strong className="activity-amount">{event.deltaCents >= 0 ? "+" : "−"}{money(Math.abs(event.deltaCents))}</strong>}</div>)}</>;
}
