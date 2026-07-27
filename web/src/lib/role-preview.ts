import type { StaffProfile, StaffRoleCode } from "@/lib/staff";
import { homePathForRole } from "@/lib/staff";

export const ROLE_PREVIEW_COOKIE = "tuttle_role_preview";

/** Roles Michael can preview in the header roster (not admin superuser). */
export const PREVIEWABLE_ROLES: StaffRoleCode[] = [
  "intake",
  "case_manager",
  "litigation_paralegal",
  "demand_writer",
  "lien_disbursement",
  "senior_paralegal",
  "attorney",
];

export type RolePreviewState = {
  role: StaffRoleCode;
  /** Optional: scope assigned caseload to this staff member's assignments */
  asStaffId?: string;
};

export type RoleRosterPerson = {
  staff_id: string;
  role_code: StaffRoleCode;
  name: string;
  email: string | null;
  is_primary: boolean;
};

export type RoleRosterGroup = {
  role: StaffRoleCode;
  label: string;
  home: string;
  people: RoleRosterPerson[];
};

export function roleLabel(role: StaffRoleCode | string): string {
  return role.replaceAll("_", " ");
}

export function canUseRolePreview(staff: StaffProfile): boolean {
  return staff.is_attorney || staff.role_code === "admin";
}

export function parseRolePreviewCookie(
  raw: string | undefined | null,
): RolePreviewState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RolePreviewState;
    if (!parsed?.role || !PREVIEWABLE_ROLES.includes(parsed.role)) return null;
    return {
      role: parsed.role,
      asStaffId: parsed.asStaffId || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Staff shape used for nav / assigned-only UI while previewing.
 * Never use for writes — real `getCurrentStaff()` remains the actor.
 */
export function viewStaffForPreview(
  real: StaffProfile,
  preview: RolePreviewState | null,
): StaffProfile {
  if (!preview || !canUseRolePreview(real)) return real;
  return {
    ...real,
    role_code: preview.role,
    roles: [preview.role],
    // † capabilities stay on the real attorney — preview must not invent Level rights
    can_approve_level:
      preview.role === "attorney" || preview.role === "admin"
        ? real.can_approve_level
        : false,
    can_clear_conflicts:
      preview.role === "attorney" || preview.role === "admin"
        ? real.can_clear_conflicts
        : false,
    is_attorney: preview.role === "attorney",
  };
}

export function previewHomePath(preview: RolePreviewState | null): string {
  if (!preview) return "/owner";
  return homePathForRole(preview.role);
}
