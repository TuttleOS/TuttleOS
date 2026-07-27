import { redirect } from "next/navigation";
import { LitCaseload } from "@/components/litigation/LitCaseload";
import { listLitigationCaseload } from "@/lib/litigation/queries";
import { getStaffViewContext } from "@/lib/staff-view";

export default async function LitigationPage() {
  const ctx = await getStaffViewContext();
  if (!ctx) redirect("/login");

  const rows = await listLitigationCaseload({
    staffId: ctx.queryStaffId,
    assignedOnly: ctx.assignedOnlyLit,
  });

  return <LitCaseload rows={rows} />;
}
