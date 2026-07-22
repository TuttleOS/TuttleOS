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

/** Default contract “cause of action” phrase from case type. */
export function defaultCausePhrase(
  caseTypeCode: string | null | undefined,
  caseTypeOther?: string | null,
): string {
  const other = caseTypeOther?.trim();
  if (caseTypeCode === "other") {
    return other || "______________________";
  }
  switch (caseTypeCode) {
    case "auto":
      return "car accident";
    case "work_injury":
      return "work injury";
    case "premises":
      return "slip and fall";
    case "wrongful_death":
      return "wrongful death";
    case "dog_bite":
      return "dog bite";
    case "motorcycle":
      return "motorcycle accident";
    case "trucking":
      return "truck accident";
    case "pedestrian":
      return "pedestrian accident";
    default:
      return other || "car accident";
  }
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
