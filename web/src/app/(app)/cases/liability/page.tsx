import { redirect } from "next/navigation";
import { LiabilityPendingQueue } from "@/components/cases/LiabilityPendingQueue";
import { listLiabilityPendingQueue } from "@/lib/cases/queries";
import type { LiabilityPendingQueueRow } from "@/lib/cases/types";
import { getStaffViewContext } from "@/lib/staff-view";

export default async function LiabilityPendingPage() {
  const ctx = await getStaffViewContext();
  if (!ctx) redirect("/login");

  const assignedOnly = ctx.assignedOnlyCm;
  let rows: LiabilityPendingQueueRow[] = [];
  let error: string | null = null;
  try {
    rows = await listLiabilityPendingQueue({
      staffId: ctx.queryStaffId,
      assignedOnly,
    });
  } catch (e) {
    error =
      e instanceof Error ? e.message : "Failed to load liability pending queue";
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-panel border border-danger/40 bg-danger-bg px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      <LiabilityPendingQueue rows={rows} />
    </div>
  );
}
