import { redirect } from "next/navigation";
import { LitMyTasks } from "@/components/litigation/LitMyTasks";
import { listMyLitTasks } from "@/lib/litigation/queries";
import { getCurrentStaff } from "@/lib/staff-server";
import { canOpenFullLitigationWorkspace } from "@/lib/workspace";

export default async function LitigationTasksPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  if (!canOpenFullLitigationWorkspace(staff.role_code)) {
    redirect("/litigation");
  }

  const tasks = await listMyLitTasks(staff.staff_id);
  return <LitMyTasks tasks={tasks} />;
}
