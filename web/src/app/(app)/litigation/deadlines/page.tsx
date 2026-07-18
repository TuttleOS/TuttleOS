import { redirect } from "next/navigation";
import { DeadlineHorizon } from "@/components/litigation/DeadlineHorizon";
import { listDeadlineHorizon } from "@/lib/litigation/queries";
import { getCurrentStaff } from "@/lib/staff-server";

export default async function LitigationDeadlinesPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

  const assignedOnly = staff.role_code === "litigation_paralegal";
  const rows = await listDeadlineHorizon({
    staffId: staff.staff_id,
    assignedOnly,
  });

  return <DeadlineHorizon rows={rows} />;
}
