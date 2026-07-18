import { redirect } from "next/navigation";
import { ProviderCalls } from "@/components/cases/ProviderCalls";
import { listProviderCallsDue } from "@/lib/cases/queries";
import type { ProviderCallDue } from "@/lib/cases/types";
import { getCurrentStaff } from "@/lib/staff-server";

export default async function ProviderCallsPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

  const ownedOnly = staff.role_code === "case_manager";
  let rows: ProviderCallDue[] = [];
  let error: string | null = null;
  try {
    rows = await listProviderCallsDue({
      staffId: staff.staff_id,
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
