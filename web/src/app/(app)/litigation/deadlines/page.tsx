import { redirect } from "next/navigation";
import { DeadlineHorizon } from "@/components/litigation/DeadlineHorizon";
import { listDeadlineHorizon } from "@/lib/litigation/queries";
import { getCurrentStaff } from "@/lib/staff-server";
import { canOpenFullLitigationWorkspace } from "@/lib/workspace";

export default async function LitigationDeadlinesPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  if (!canOpenFullLitigationWorkspace(staff.role_code)) {
    redirect("/litigation");
  }

  const assignedOnly = staff.role_code === "litigation_paralegal";
  const rows = await listDeadlineHorizon({
    staffId: staff.staff_id,
    assignedOnly,
  });

  return <DeadlineHorizon rows={rows} />;
}
