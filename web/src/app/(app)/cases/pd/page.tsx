import { redirect } from "next/navigation";
import { PdPendingQueue } from "@/components/cases/PdPendingQueue";
import { listPdPendingQueue } from "@/lib/cases/queries";
import type { PdPendingQueueRow } from "@/lib/cases/types";
import { getCurrentStaff } from "@/lib/staff-server";

export default async function PdPendingPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

  const assignedOnly = staff.role_code === "case_manager";
  let rows: PdPendingQueueRow[] = [];
  let error: string | null = null;
  try {
    rows = await listPdPendingQueue({
      staffId: staff.staff_id,
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
