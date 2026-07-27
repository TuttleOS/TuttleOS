import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { StaffRoleCode } from "@/lib/staff";
import {
  PREVIEWABLE_ROLES,
  ROLE_PREVIEW_COOKIE,
  parseRolePreviewCookie,
  roleLabel,
  type RolePreviewState,
  type RoleRosterGroup,
  type RoleRosterPerson,
} from "@/lib/role-preview";

export function getRolePreviewState(): RolePreviewState | null {
  const raw = cookies().get(ROLE_PREVIEW_COOKIE)?.value;
  return parseRolePreviewCookie(raw ?? null);
}

export async function listRoleRoster(): Promise<RoleRosterGroup[]> {
  const supabase = createClient();
  const { data: staffRows, error } = await supabase
    .schema("core")
    .from("staff")
    .select(
      "staff_id, role_code, email, active, person:person_id(first_name, last_name)",
    )
    .eq("active", true)
    .order("role_code");

  if (error) throw new Error(error.message);

  const peopleByRole = new Map<StaffRoleCode, RoleRosterPerson[]>();

  for (const row of staffRows ?? []) {
    const role = row.role_code as StaffRoleCode;
    if (!PREVIEWABLE_ROLES.includes(role) && role !== "admin") continue;
    const p = row.person as unknown as {
      first_name: string;
      last_name: string;
    } | null;
    const name = p
      ? `${p.first_name} ${p.last_name}`.trim()
      : (row.email ?? "Staff");
    const person: RoleRosterPerson = {
      staff_id: row.staff_id,
      role_code: role,
      name,
      email: row.email,
      is_primary: true,
    };
    const list = peopleByRole.get(role) ?? [];
    list.push(person);
    peopleByRole.set(role, list);
  }

  // Include secondary grants (e.g. future Emily CM + lien)
  const { data: grants } = await supabase
    .schema("core")
    .from("staff_role_grant")
    .select("staff_id, role_code, is_primary")
    .is("ended_at", null);

  if (grants?.length) {
    const byId = new Map(
      (staffRows ?? []).map((s) => [s.staff_id, s]),
    );
    for (const g of grants) {
      const role = g.role_code as StaffRoleCode;
      if (!PREVIEWABLE_ROLES.includes(role)) continue;
      const s = byId.get(g.staff_id);
      if (!s) continue;
      const existing = peopleByRole.get(role) ?? [];
      if (existing.some((x) => x.staff_id === g.staff_id)) continue;
      const p = s.person as unknown as {
        first_name: string;
        last_name: string;
      } | null;
      existing.push({
        staff_id: g.staff_id,
        role_code: role,
        name: p
          ? `${p.first_name} ${p.last_name}`.trim()
          : ((s.email as string | null) ?? "Staff"),
        email: (s.email as string | null) ?? null,
        is_primary: !!g.is_primary,
      });
      peopleByRole.set(role, existing);
    }
  }

  const groups: RoleRosterGroup[] = PREVIEWABLE_ROLES.map((role) => ({
    role,
    label: roleLabel(role),
    home:
      role === "attorney"
        ? "/owner"
        : role === "senior_paralegal"
          ? "/owner"
          : role === "intake"
            ? "/intake"
            : role === "case_manager"
              ? "/cases"
              : role === "litigation_paralegal"
                ? "/litigation"
                : role === "demand_writer"
                  ? "/demands"
                  : "/liens",
    people: (peopleByRole.get(role) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  }));

  return groups;
}
