import { createClient } from "@/lib/supabase/server";
import type { StaffProfile, StaffRoleCode } from "@/lib/staff";

export async function getCurrentStaff(): Promise<StaffProfile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .schema("core")
    .from("staff")
    .select(
      "staff_id, role_code, email, is_attorney, can_approve_level, can_clear_conflicts, active, person:person_id(first_name, last_name)",
    )
    .eq("auth_user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (error || !data) return null;

  const staff = data as unknown as StaffProfile;
  const roles = new Set<StaffRoleCode>([staff.role_code]);

  const { data: grants, error: grantErr } = await supabase
    .schema("core")
    .from("staff_role_grant")
    .select("role_code, is_primary")
    .eq("staff_id", staff.staff_id)
    .is("ended_at", null);

  // Table may be missing before v2.19 migration — fall back to primary only
  if (!grantErr && grants?.length) {
    for (const g of grants) {
      roles.add(g.role_code as StaffRoleCode);
      if (g.is_primary) {
        staff.role_code = g.role_code as StaffRoleCode;
      }
    }
  }

  staff.roles = Array.from(roles);
  return staff;
}
