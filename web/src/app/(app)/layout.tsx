import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { getCurrentStaff } from "@/lib/staff-server";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await getCurrentStaff();
  if (!staff) {
    redirect("/login?next=/cases");
  }
  return <AppShell staff={staff}>{children}</AppShell>;
}
