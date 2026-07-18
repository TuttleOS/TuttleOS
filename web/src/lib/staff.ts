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
  role_code: StaffRoleCode;
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

/** Route after login by role_code (MASTER_PROMPT §4). */
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
