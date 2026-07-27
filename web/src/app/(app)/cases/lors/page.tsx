import { redirect } from "next/navigation";
import { LorPendingQueue } from "@/components/cases/LorPendingQueue";
import { listLorPendingQueue } from "@/lib/cases/queries";
import type { LorPendingQueueRow } from "@/lib/cases/types";
import { getStaffViewContext } from "@/lib/staff-view";

export default async function LorsPendingPage() {
  const ctx = await getStaffViewContext();
  if (!ctx) redirect("/login");

  const assignedOnly = ctx.assignedOnlyCm;
  let rows: LorPendingQueueRow[] = [];
  let error: string | null = null;
  try {
    rows = await listLorPendingQueue({
      staffId: ctx.queryStaffId,
      assignedOnly,
    });
  } catch (e) {
    error =
      e instanceof Error ? e.message : "Failed to load LORs pending queue";
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-panel border border-danger/40 bg-danger-bg px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      <LorPendingQueue rows={rows} />
    </div>
  );
}
