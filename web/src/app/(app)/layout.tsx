import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { countCmWorkQueues } from "@/lib/cases/queries";
import { getStaffViewContext } from "@/lib/staff-view";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getStaffViewContext();
  if (!ctx) {
    redirect("/login?next=/cases");
  }

  let cmQueueCounts: {
    newCases: number;
    lors: number;
    liability: number;
    pd: number;
    records: number;
  } | null = null;
  try {
    cmQueueCounts = await countCmWorkQueues({
      staffId: ctx.queryStaffId,
      assignedOnly: ctx.assignedOnlyCm,
    });
  } catch {
    cmQueueCounts = null;
  }

  return (
    <AppShell
      staff={ctx.staff}
      viewStaff={ctx.viewStaff}
      preview={ctx.preview}
      roster={ctx.roster}
      previewScopedName={ctx.previewScopedName}
      cmQueueCounts={cmQueueCounts}
    >
      {children}
    </AppShell>
  );
}
