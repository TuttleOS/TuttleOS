import { redirect } from "next/navigation";
import { OwnerDashboard } from "@/components/owner/OwnerDashboard";
import {
  listFirmStalled,
  listOverridePatterns,
  listPendingApprovals,
  listSolWatch,
  ownerTiles,
} from "@/lib/owner/queries";
import { getCurrentStaff } from "@/lib/staff-server";

export default async function OwnerPage({
  searchParams,
}: {
  searchParams?: { flag?: string };
}) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

  const [stalled, approvals, sol, overrides] = await Promise.all([
    listFirmStalled(),
    listPendingApprovals(),
    listSolWatch(),
    listOverridePatterns(),
  ]);

  return (
    <OwnerDashboard
      stalled={stalled}
      tiles={ownerTiles(stalled, approvals, sol)}
      approvals={approvals}
      overrides={overrides}
      firstName={staff.person?.first_name || "there"}
      initialFilter={searchParams?.flag ?? "all"}
    />
  );
}
