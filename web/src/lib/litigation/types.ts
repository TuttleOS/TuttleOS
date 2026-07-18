export type HorizonRow = {
  deadline_id: string;
  client_matter_id: string | null;
  display_name: string | null;
  label: string;
  effective_date: string;
  jurisdictional: boolean;
  owner_staff_id: string | null;
  authority: string | null;
  source?: string | null;
};

export type LitCaseloadRow = {
  client_matter_id: string;
  display_name: string;
  matter_number: string | null;
  current_stage_code: string;
  sol_date: string | null;
  cause_number: string | null;
  court_name: string | null;
  filed_date: string | null;
  discovery_level: number | null;
  next_deadline_label: string | null;
  next_deadline_date: string | null;
  next_deadline_jx: boolean;
  cm_name: string | null;
  pl_name: string | null;
  preferred_language: string | null;
  case_type_code: string | null;
};

export type CourtCaseRow = {
  court_case_id: string;
  cause_number: string | null;
  filed_date: string | null;
  discovery_level: number | null;
  dco_signed_date: string | null;
  jury_demanded: boolean;
  hb19_applies: boolean;
  status: string;
  court_name: string | null;
};

/** UI stage groups for My Tasks (mockup 7a). */
export const LIT_TASK_GROUPS: { key: string; label: string; match: RegExp }[] = [
  {
    key: "filing",
    label: "Filing & Service",
    match: /fil(e|ing)|service|citation|petition/i,
  },
  {
    key: "answers",
    label: "Answers & Disclosures",
    match: /answer|disclosure|194/i,
  },
  {
    key: "discovery",
    label: "Written Discovery",
    match: /discovery|interrogator|rfp|rfa|production/i,
  },
  { key: "depo", label: "Depositions", match: /depo/i },
  { key: "mediation", label: "Mediation", match: /mediat/i },
  { key: "trial", label: "Trial Prep", match: /trial|pretrial|exhibit/i },
];

export function taskGroupKey(title: string, taskType?: string | null, source?: string | null): string {
  const blob = `${title} ${taskType ?? ""} ${source ?? ""}`;
  for (const g of LIT_TASK_GROUPS) {
    if (g.match.test(blob)) return g.key;
  }
  return "general";
}
