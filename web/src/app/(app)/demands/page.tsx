import { redirect } from "next/navigation";
import { DemandQueueSkeleton } from "@/components/phase7/DemandQueueSkeleton";
import {
  listDemandReadiness,
  type DemandReadinessRow,
} from "@/lib/phase7/queries";
import { getCurrentStaff } from "@/lib/staff-server";

export default async function DemandsPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

  let rows: DemandReadinessRow[] = [];
  let error: string | null = null;
  try {
    rows = await listDemandReadiness();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load demand readiness";
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-panel border border-danger/40 bg-danger-bg px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      <DemandQueueSkeleton rows={rows} />
    </div>
  );
}
