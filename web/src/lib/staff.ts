export type StaffRoleCode =
  | "attorney"
  | "senior_paralegal"
  | "litigation_paralegal"
  | "case_manager"
  | "intake"
  | "demand_writer"
  | "lien_disbursement"
  | "admin";

export type StaffProfile = {
  staff_id: string;
  /** Primary role (drives home routing). Additional grants live in `roles`. */
  role_code: StaffRoleCode;
  /** All active role grants including primary. Defaults to `[role_code]` when unset. */
  roles?: StaffRoleCode[];
  email: string | null;
  is_attorney: boolean;
  can_approve_level: boolean;
  can_clear_conflicts: boolean;
  active: boolean;
  person?: {
    first_name: string;
    last_name: string;
  } | null;
};

/** Active role codes for this staff (primary + grants). */
export function staffRoles(staff: Pick<StaffProfile, "role_code" | "roles">): StaffRoleCode[] {
  if (staff.roles?.length) return staff.roles;
  return [staff.role_code];
}

export function hasRole(
  staff: Pick<StaffProfile, "role_code" | "roles">,
  role: StaffRoleCode | string,
): boolean {
  return staffRoles(staff).includes(role as StaffRoleCode);
}

/** † Level approval — flags / attorney only; never role_code alone (ROLES §8.1#3). */
export function staffCanApproveLevel(
  staff: Pick<StaffProfile, "is_attorney" | "can_approve_level">,
): boolean {
  return staff.is_attorney || staff.can_approve_level;
}

/** † Conflict clearance — flags / attorney only. */
export function staffCanClearConflicts(
  staff: Pick<StaffProfile, "is_attorney" | "can_clear_conflicts">,
): boolean {
  return staff.is_attorney || staff.can_clear_conflicts;
}

/** Demand / lien specialty: matter view is read-only until Pass 4 finance UI. */
export function isMatterReadOnlyRole(
  staff: Pick<StaffProfile, "role_code" | "roles">,
): boolean {
  return hasRole(staff, "demand_writer") || hasRole(staff, "lien_disbursement");
}

/** CM queue / caseload: assigned-only unless firm-wide role (attorney/admin/senior PL). */
export function usesAssignedOnlyCaseload(
  staff: Pick<StaffProfile, "role_code" | "roles" | "is_attorney">,
): boolean {
  if (staff.is_attorney) return false;
  if (staff.role_code === "admin" || staff.role_code === "senior_paralegal") {
    return false;
  }
  return hasRole(staff, "case_manager");
}

/** Lit PL caseload: assigned-only unless firm-wide role. */
export function usesAssignedOnlyLitigation(
  staff: Pick<StaffProfile, "role_code" | "roles" | "is_attorney">,
): boolean {
  if (staff.is_attorney) return false;
  if (staff.role_code === "admin" || staff.role_code === "senior_paralegal") {
    return false;
  }
  return hasRole(staff, "litigation_paralegal");
}

/**
 * Finance detail writes — attorney or lien_disbursement only.
 * Admin may read firm-wide but must not write finance until Michael names admin duties (§8.1#5).
 */
export function staffCanWriteFinance(
  staff: Pick<StaffProfile, "is_attorney" | "role_code" | "roles">,
): boolean {
  return staff.is_attorney || hasRole(staff, "lien_disbursement");
}

/** Route after login by primary role_code (MASTER_PROMPT §4). */
export function homePathForRole(role: StaffRoleCode | string | null | undefined): string {
  switch (role) {
    case "intake":
      return "/intake";
    case "case_manager":
      return "/cases";
    case "litigation_paralegal":
      return "/litigation";
    case "attorney":
    case "admin":
    case "senior_paralegal":
      return "/owner";
    case "demand_writer":
      return "/demands";
    case "lien_disbursement":
      return "/liens";
    default:
      return "/cases";
  }
}

export function displayName(staff: StaffProfile | null): string {
  if (!staff?.person) return staff?.email ?? "Staff";
  return `${staff.person.first_name} ${staff.person.last_name}`.trim();
}
