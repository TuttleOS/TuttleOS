import { redirect } from "next/navigation";
import { LienWorklistSkeleton } from "@/components/phase7/LienWorklistSkeleton";
import { listLienWorklist, type LienWorklistRow } from "@/lib/phase7/queries";
import { getCurrentStaff } from "@/lib/staff-server";

export default async function LiensPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

  let rows: LienWorklistRow[] = [];
  let error: string | null = null;
  try {
    rows = await listLienWorklist();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load lien worklist";
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-panel border border-danger/40 bg-danger-bg px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      <LienWorklistSkeleton rows={rows} />
    </div>
  );
}
