import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { countCmWorkQueues } from "@/lib/cases/queries";
import { getCurrentStaff } from "@/lib/staff-server";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await getCurrentStaff();
  if (!staff) {
    redirect("/login?next=/cases");
  }

  let cmQueueCounts: { newCases: number; lors: number } | null = null;
  try {
    cmQueueCounts = await countCmWorkQueues({
      staffId: staff.staff_id,
      assignedOnly: staff.role_code === "case_manager",
    });
  } catch {
    cmQueueCounts = null;
  }

  return (
    <AppShell staff={staff} cmQueueCounts={cmQueueCounts}>
      {children}
    </AppShell>
  );
}
