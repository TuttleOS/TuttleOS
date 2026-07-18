import { createClient } from "@/lib/supabase/server";
import type { StaffProfile } from "@/lib/staff";

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
  return data as unknown as StaffProfile;
}
