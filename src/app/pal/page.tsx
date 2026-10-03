import { PalDashboard } from "@/components/pal/PalDashboard";
import { loadDashboard } from "@/server/dashboard";

export const dynamic = "force-dynamic";
export default async function PalPage() {
  const { data, preview } = await loadDashboard();
  return <PalDashboard data={data} preview={preview} />;
}
