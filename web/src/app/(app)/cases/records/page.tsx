import { redirect } from "next/navigation";
import { RecordsPendingQueue } from "@/components/cases/RecordsPendingQueue";
import { listRecordsPendingQueue } from "@/lib/cases/queries";
import type { RecordsPendingQueueRow } from "@/lib/cases/types";
import { getCurrentStaff } from "@/lib/staff-server";

export default async function RecordsPendingPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

  const assignedOnly = staff.role_code === "case_manager";
  let rows: RecordsPendingQueueRow[] = [];
  let error: string | null = null;
  try {
    rows = await listRecordsPendingQueue({
      staffId: staff.staff_id,
      assignedOnly,
    });
  } catch (e) {
    error =
      e instanceof Error ? e.message : "Failed to load records pending queue";
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-panel border border-danger/40 bg-danger-bg px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      <RecordsPendingQueue rows={rows} />
    </div>
  );
}
