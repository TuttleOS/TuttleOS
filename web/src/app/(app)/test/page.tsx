import { redirect } from "next/navigation";
import { OwnerTestNotes } from "@/components/owner/OwnerTestNotes";
import { getCurrentStaff } from "@/lib/staff-server";

export default async function OwnerTestPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  // Michael (attorney) + Brett (admin) — same gate as calendar / migration
  if (!staff.is_attorney && staff.role_code !== "admin") {
    redirect(staff.role_code === "intake" ? "/intake" : "/cases");
  }

  return <OwnerTestNotes />;
}
