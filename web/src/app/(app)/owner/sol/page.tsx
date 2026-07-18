import { redirect } from "next/navigation";
import { SolWatch } from "@/components/owner/SolWatch";
import { listSolWatch } from "@/lib/owner/queries";
import { getCurrentStaff } from "@/lib/staff-server";

export default async function OwnerSolPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

  const rows = await listSolWatch();
  return <SolWatch rows={rows} />;
}
