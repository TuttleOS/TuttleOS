import type { StalledRow } from "@/lib/cases/types";

export type { StalledRow };

export type SolRow = {
  client_matter_id: string;
  casepeer_case_id: string | null;
  client: string;
  current_stage_code: string;
  stored_sol: string | null;
  computed_sol: string | null;
  delta_days: number | null;
  reconciliation: string;
  sol_status: string | null;
};

export type LevelApproval = {
  kind: "level";
  client_matter_id: string;
  display_name: string;
  current_stage_code: string;
  recommended_level: number;
  recommended_level_rationale: string | null;
  approved_level: number | null;
};

export type DemandApproval = {
  kind: "l3_demand";
  client_matter_id: string;
  display_name: string;
  demand_id: string;
  approved_level: number | null;
  kate_reviewed: boolean;
};

export type ApprovalItem = LevelApproval | DemandApproval;

export type OverridePattern = {
  staff: string;
  title: string;
  overrides_90d: number;
  most_recent: string | null;
  recent_reasons: string[] | null;
};

export const OWNER_FLAG_FILTERS: {
  key: string;
  label: string;
  match: (r: StalledRow) => boolean;
}[] = [
  { key: "all", label: "All cases", match: () => true },
  {
    key: "missing_level",
    label: "Missing case Level",
    match: (r) => r.flag_missing_level,
  },
  {
    key: "sol",
    label: "Filing deadline soon",
    match: (r) => r.flag_sol_within_120d,
  },
  {
    key: "pd",
    label: "Property damage open",
    match: (r) => r.flag_pd_unresolved,
  },
  {
    key: "demand",
    label: "Demand response late",
    match: (r) => r.flag_demand_response_overdue,
  },
  {
    key: "records",
    label: "Records aging",
    match: (r) => r.flag_records_not_ordered,
  },
  {
    key: "disbursement",
    label: "Disbursement aging",
    match: (r) => r.flag_disbursement_aging,
  },
  {
    key: "viability",
    label: "7-day review overdue",
    match: (r) => r.flag_viability_overdue,
  },
  {
    key: "attention",
    label: "Needs attention",
    match: (r) =>
      r.flag_missing_level ||
      r.flag_sol_within_120d ||
      r.flag_viability_overdue ||
      r.flag_pd_unresolved ||
      r.flag_demand_response_overdue ||
      r.flag_records_not_ordered ||
      r.flag_disbursement_aging ||
      r.flag_no_client_contact_30d ||
      r.flag_provider_check_overdue ||
      !r.case_manager,
  },
];

export function reconciliationLabel(code: string): string {
  switch (code) {
    case "match":
      return "Match";
    case "STORED_LATER_REVIEW_tolling_or_error":
      return "Stored later — review";
    case "stored_earlier_conservative":
      return "Stored earlier (conservative)";
    case "no_computation":
      return "No computation";
    case "no_stored_value":
      return "No stored SOL";
    default:
      return code;
  }
}

export function matterHref(stage: string, matterId: string): string {
  // Prefer Case Manager matter view from firm / owner surfaces (Michael call A3).
  // Stage-based lit routing remains available via explicit /litigation/[id] links.
  void stage;
  return `/cases/${matterId}`;
}
