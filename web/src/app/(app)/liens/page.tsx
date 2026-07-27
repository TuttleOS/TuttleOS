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
      <div className="rounded-panel border border-warning/40 bg-warning-bg/40 px-4 py-3 text-sm">
        <strong className="font-semibold">Finance UI not shipped yet.</strong>{" "}
        You hold the finance data tier with the attorney, but settlement →
        trust → disbursement screens are blocked until that UI lands (ROLES
        §8.1#8). Matter links below are <em>read-only</em> file review.
      </div>
      {error && (
        <p className="rounded-panel border border-danger/40 bg-danger-bg px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      <LienWorklistSkeleton rows={rows} />
    </div>
  );
}
