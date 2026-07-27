import { listCaseload } from "@/lib/cases/queries";
import { Caseload } from "@/components/cases/Caseload";
import { redirect } from "next/navigation";
import { getStaffViewContext } from "@/lib/staff-view";

export default async function CasesPage() {
  const ctx = await getStaffViewContext();
  if (!ctx) redirect("/login");

  const rows = await listCaseload({
    staffId: ctx.queryStaffId,
    assignedOnly: ctx.assignedOnlyCm,
  });

  return <Caseload rows={rows} />;
}
