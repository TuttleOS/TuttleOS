import { redirect } from "next/navigation";
import { ViabilityQueueSkeleton } from "@/components/phase7/ViabilityQueueSkeleton";
import {
  listOpenViabilityReviews,
  type ViabilityQueueRow,
} from "@/lib/phase7/queries";
import { getCurrentStaff } from "@/lib/staff-server";

export default async function ReviewPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

  let rows: ViabilityQueueRow[] = [];
  let error: string | null = null;
  try {
    rows = await listOpenViabilityReviews();
  } catch (e) {
    error =
      e instanceof Error ? e.message : "Failed to load viability reviews";
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-panel border border-danger/40 bg-danger-bg px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      <ViabilityQueueSkeleton rows={rows} />
    </div>
  );
}
