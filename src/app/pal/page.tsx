import { PalDashboard } from "@/components/pal/PalDashboard";
import { loadDashboard } from "@/server/dashboard";
import { startDemoAction } from "@/server/actions";

export const dynamic = "force-dynamic";
export default async function PalPage() {
  const loaded = await loadDashboard();
  if (!loaded) return <main className="loading-screen"><h1 className="wordmark">pal<span>✦</span></h1><h2>Your own space to try Pal</h2><p>Start with sample money. Your buckets and choices will be saved in this browser’s demo session.</p><form action={startDemoAction}><button className="primary-button">Start my demo</button></form><p className="micro">Local prototype · no real account connection</p></main>;
  const { data, preview } = loaded;
  return <PalDashboard data={data} preview={preview} />;
}
