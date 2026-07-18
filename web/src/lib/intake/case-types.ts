/** Map Intake UI labels ↔ ref.case_type.code */

export const CASE_TYPE_OPTIONS: { code: string; label: string }[] = [
  { code: "auto", label: "Car Crash" },
  { code: "work_injury", label: "Work Injury" },
  { code: "premises", label: "Slip and Fall / Premises" },
  { code: "wrongful_death", label: "Wrongful Death" },
  { code: "dog_bite", label: "Dog Bite" },
  { code: "other", label: "Other" },
];

export function caseTypeLabel(code: string | null | undefined): string {
  if (!code) return "—";
  return CASE_TYPE_OPTIONS.find((c) => c.code === code)?.label ?? code;
}

export function defaultClientRole(caseTypeCode: string | null): string {
  if (caseTypeCode === "auto" || caseTypeCode === "motorcycle" || caseTypeCode === "trucking") {
    return "driver";
  }
  if (caseTypeCode === "pedestrian") return "pedestrian";
  if (caseTypeCode === "premises") return "patron";
  if (caseTypeCode === "work_injury") return "worker";
  return "other";
}
