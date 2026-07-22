import { redirect } from "next/navigation";
import { NewCasesQueue } from "@/components/cases/NewCasesQueue";
import { listNewCasesQueue } from "@/lib/cases/queries";
import type { NewCaseQueueRow } from "@/lib/cases/types";
import { getCurrentStaff } from "@/lib/staff-server";

export default async function NewCasesPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

  const assignedOnly = staff.role_code === "case_manager";
  let rows: NewCaseQueueRow[] = [];
  let error: string | null = null;
  try {
    rows = await listNewCasesQueue({
      staffId: staff.staff_id,
      assignedOnly,
    });
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load new cases queue";
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-panel border border-danger/40 bg-danger-bg px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      <NewCasesQueue rows={rows} />
    </div>
  );
}
