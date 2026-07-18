/** Treatment coverage boxes (Michael 2026-07-13) — maps UI category → provider_type(s). */

export const COVERAGE_CATEGORIES = [
  {
    code: "ems",
    label: "Ambulance / EMS",
    providerTypes: ["ems"],
  },
  {
    code: "hospital_er",
    label: "Hospital / ER",
    providerTypes: ["hospital", "emergency"],
  },
  {
    code: "urgent_care",
    label: "Urgent care",
    providerTypes: ["urgent_care"],
  },
  {
    code: "chiro",
    label: "Chiro",
    providerTypes: ["chiropractic"],
  },
  {
    code: "pt",
    label: "PT",
    providerTypes: ["physical_therapy"],
  },
  {
    code: "imaging",
    label: "Imaging",
    providerTypes: ["imaging"],
  },
  {
    code: "pain_mgmt",
    label: "Pain mgmt",
    providerTypes: ["pain_management"],
  },
  {
    code: "surgical",
    label: "Surgical",
    providerTypes: ["surgery_center", "orthopedic"],
  },
  {
    code: "other",
    label: "Other",
    providerTypes: [
      "other",
      "primary_care",
      "mental_health",
      "neurology",
      "pharmacy",
    ],
  },
] as const;

export type CoverageCategoryCode = (typeof COVERAGE_CATEGORIES)[number]["code"];

export const PROVIDER_TYPE_OPTIONS = [
  "ems",
  "hospital",
  "emergency",
  "urgent_care",
  "chiropractic",
  "physical_therapy",
  "imaging",
  "pain_management",
  "surgery_center",
  "orthopedic",
  "neurology",
  "primary_care",
  "mental_health",
  "pharmacy",
  "other",
] as const;

export function defaultProviderTypeForCategory(
  code: CoverageCategoryCode,
): string {
  const cat = COVERAGE_CATEGORIES.find((c) => c.code === code);
  return cat?.providerTypes[0] ?? "other";
}
