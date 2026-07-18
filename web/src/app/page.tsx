import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/staff-server";
import { homePathForRole } from "@/lib/staff";

export default async function HomePage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  redirect(homePathForRole(staff.role_code));
}
