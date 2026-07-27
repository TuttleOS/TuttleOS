import { redirect } from "next/navigation";
import { PdPendingQueue } from "@/components/cases/PdPendingQueue";
import { listPdPendingQueue } from "@/lib/cases/queries";
import type { PdPendingQueueRow } from "@/lib/cases/types";
import { getStaffViewContext } from "@/lib/staff-view";

export default async function PdPendingPage() {
  const ctx = await getStaffViewContext();
  if (!ctx) redirect("/login");

  const assignedOnly = ctx.assignedOnlyCm;
  let rows: PdPendingQueueRow[] = [];
  let error: string | null = null;
  try {
    rows = await listPdPendingQueue({
      staffId: ctx.queryStaffId,
      assignedOnly,
    });
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load PD pending queue";
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-panel border border-danger/40 bg-danger-bg px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      <PdPendingQueue rows={rows} />
    </div>
  );
}
