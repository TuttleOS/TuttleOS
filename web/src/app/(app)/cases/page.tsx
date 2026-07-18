import { listCaseload } from "@/lib/cases/queries";
import { getCurrentStaff } from "@/lib/staff-server";
import { Caseload } from "@/components/cases/Caseload";
import { redirect } from "next/navigation";

export default async function CasesPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

  const assignedOnly = staff.role_code === "case_manager";
  const rows = await listCaseload({
    staffId: staff.staff_id,
    assignedOnly,
  });

  return <Caseload rows={rows} />;
}
