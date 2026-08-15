import { redirect } from "next/navigation";
import { MyTasks } from "@/components/cases/MyTasks";
import { listMyTasks } from "@/lib/cases/queries";
import { getStaffViewContext } from "@/lib/staff-view";

export default async function CasesTasksPage() {
  const ctx = await getStaffViewContext();
  if (!ctx) redirect("/login");

  const tasks = await listMyTasks(ctx.queryStaffId, {
    hideLitigation: ctx.viewStaff.role_code === "case_manager",
  });
  return <MyTasks tasks={tasks} />;
}
