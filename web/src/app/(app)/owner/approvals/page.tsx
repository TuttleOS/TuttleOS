import { redirect } from "next/navigation";
import { ApprovalsQueue } from "@/components/owner/ApprovalsQueue";
import { listPendingApprovals } from "@/lib/owner/queries";
import { getCurrentStaff } from "@/lib/staff-server";

export default async function OwnerApprovalsPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

  const items = await listPendingApprovals();
  return (
    <ApprovalsQueue items={items} canApprove={!!staff.can_approve_level} />
  );
}
