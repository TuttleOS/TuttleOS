import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStaff } from "@/lib/staff-server";

/**
 * Smoke endpoint for Intake RLS: intake-only staff must not read medical.*.
 * Attorneys/admins may receive rows (or empty) — success means SELECT was allowed.
 */
export async function GET() {
  const staff = await getCurrentStaff();
  if (!staff) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .schema("medical")
    .from("treatment_episode")
    .select("treatment_episode_id")
    .limit(1);

  const allowed = !error;
  const intakeOnly = staff.role_code === "intake" && !staff.is_attorney;

  return NextResponse.json({
    ok: true,
    role_code: staff.role_code,
    is_attorney: staff.is_attorney,
    intake_only: intakeOnly,
    medical_select_allowed: allowed,
    medical_error: error?.message ?? null,
    row_count: data?.length ?? 0,
    rls_blocks_intake: intakeOnly ? !allowed || (data?.length ?? 0) === 0 : null,
  });
}
