import { redirect } from "next/navigation";
import { MigrationStatus } from "@/components/owner/MigrationStatus";
import { getMigrationStats } from "@/lib/owner/migration";
import { getCurrentStaff } from "@/lib/staff-server";

export default async function OwnerMigrationPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  if (!staff.is_attorney && staff.role_code !== "admin") {
    redirect("/owner");
  }

  let stats;
  let error: string | null = null;
  try {
    stats = await getMigrationStats();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load migration stats";
    stats = {
      casepeerMatters: 0,
      solNeedsReview: 0,
      byStage: [],
      recent: [],
    };
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-panel border border-danger/40 bg-danger-bg px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      <MigrationStatus stats={stats} />
    </div>
  );
}
