import { redirect } from "next/navigation";
import { ProviderCalls } from "@/components/cases/ProviderCalls";
import { listProviderCallsDue } from "@/lib/cases/queries";
import type { ProviderCallDue } from "@/lib/cases/types";
import { getStaffViewContext } from "@/lib/staff-view";

export default async function ProviderCallsPage() {
  const ctx = await getStaffViewContext();
  if (!ctx) redirect("/login");

  const ownedOnly = ctx.assignedOnlyCm;
  let rows: ProviderCallDue[] = [];
  let error: string | null = null;
  try {
    rows = await listProviderCallsDue({
      staffId: ctx.queryStaffId,
      ownedOnly,
    });
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load provider calls";
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-panel border border-danger/40 bg-danger-bg px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      <ProviderCalls rows={rows} />
    </div>
  );
}
