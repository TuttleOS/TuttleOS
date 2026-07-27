import { getCurrentStaff } from "@/lib/staff-server";
import {
  usesAssignedOnlyCaseload,
  usesAssignedOnlyLitigation,
  type StaffProfile,
} from "@/lib/staff";
import {
  canUseRolePreview,
  viewStaffForPreview,
  type RolePreviewState,
} from "@/lib/role-preview";
import {
  getRolePreviewState,
  listRoleRoster,
} from "@/lib/role-preview-server";
import type { RoleRosterGroup } from "@/lib/role-preview";
import { createClient } from "@/lib/supabase/server";

export type StaffViewContext = {
  /** Real signed-in staff — always the audit actor */
  staff: StaffProfile;
  /** Staff shape for nav / assigned-only UI */
  viewStaff: StaffProfile;
  preview: RolePreviewState | null;
  /** staff_id used for assigned caseload queries */
  queryStaffId: string;
  assignedOnlyCm: boolean;
  assignedOnlyLit: boolean;
  roster: RoleRosterGroup[];
  previewScopedName: string | null;
};

export async function getStaffViewContext(): Promise<StaffViewContext | null> {
  const staff = await getCurrentStaff();
  if (!staff) return null;

  const preview = canUseRolePreview(staff) ? getRolePreviewState() : null;
  const viewStaff = viewStaffForPreview(staff, preview);

  let roster: RoleRosterGroup[] = [];
  if (canUseRolePreview(staff)) {
    try {
      roster = await listRoleRoster();
    } catch {
      roster = [];
    }
  }

  let previewScopedName: string | null = null;
  if (preview?.asStaffId) {
    const match = roster
      .flatMap((g) => g.people)
      .find((p) => p.staff_id === preview.asStaffId);
    previewScopedName = match?.name ?? null;
    if (!previewScopedName) {
      const supabase = createClient();
      const { data } = await supabase
        .schema("core")
        .from("staff")
        .select("email, person:person_id(first_name, last_name)")
        .eq("staff_id", preview.asStaffId)
        .maybeSingle();
      if (data) {
        const p = data.person as unknown as {
          first_name: string;
          last_name: string;
        } | null;
        previewScopedName = p
          ? `${p.first_name} ${p.last_name}`.trim()
          : data.email;
      }
    }
  }

  const queryStaffId = preview?.asStaffId ?? staff.staff_id;
  const assignedOnlyCm = usesAssignedOnlyCaseload(viewStaff);
  const assignedOnlyLit = usesAssignedOnlyLitigation(viewStaff);

  return {
    staff,
    viewStaff,
    preview,
    queryStaffId,
    assignedOnlyCm,
    assignedOnlyLit,
    roster,
    previewScopedName,
  };
}
