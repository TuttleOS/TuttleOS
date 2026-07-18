import { redirect } from "next/navigation";
import { MyTasks } from "@/components/cases/MyTasks";
import { listMyTasks } from "@/lib/cases/queries";
import { getCurrentStaff } from "@/lib/staff-server";

export default async function CasesTasksPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

  const tasks = await listMyTasks(staff.staff_id);
  return <MyTasks tasks={tasks} />;
}
