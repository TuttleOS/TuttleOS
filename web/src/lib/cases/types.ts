/** Case Manager workspace types */

export type MatterStageCode =
  | "intake"
  | "viability"
  | "treating"
  | "records"
  | "demand"
  | "negotiation"
  | "litigation"
  | "settlement"
  | "closed";

export const STAGE_LABEL: Record<string, string> = {
  intake: "Intake",
  viability: "7-Day Review",
  treating: "Treating",
  records: "Records",
  demand: "Demand",
  negotiation: "Negotiation",
  litigation: "Litigation",
  settlement: "Settlement",
  closed: "Closed",
};

export type StalledRow = {
  client_matter_id: string;
  display_name: string;
  current_stage_code: string;
  stage_entered_at: string;
  case_manager: string | null;
  case_age_days: number | null;
  days_in_stage: number | null;
  critical_note: string | null;
  tbi_indicated: boolean;
  approved_level: number | null;
  flag_missing_level: boolean;
  flag_viability_overdue: boolean;
  flag_no_client_contact_30d: boolean;
  flag_provider_check_overdue: boolean;
  flag_treatment_compliance: boolean;
  flag_records_not_ordered: boolean;
  flag_pd_unresolved: boolean;
  flag_demand_response_overdue: boolean;
  flag_dps_record_outstanding: boolean;
  flag_public_records_outstanding: boolean;
  flag_disbursement_aging: boolean;
  flag_sol_within_120d: boolean;
};

export type CaseloadRow = StalledRow & {
  matter_number: string | null;
  sol_date: string | null;
  sol_status: string | null;
  sign_up_date: string | null;
  minor_or_incapacitated: boolean;
  preferred_language: string | null;
  case_type_code: string | null;
  date_of_loss: string | null;
  cm_name: string | null;
  pl_name: string | null;
  companion_count: number;
  open_checklist: number;
};

export type MatterDetail = {
  client_matter_id: string;
  matter_number: string | null;
  incident_group_id: string;
  client_person_id: string;
  current_stage_code: string;
  stage_entered_at: string;
  sign_up_date: string | null;
  contract_signed_date: string | null;
  sol_date: string | null;
  sol_status: string | null;
  approved_level: number | null;
  recommended_level: number | null;
  minor_or_incapacitated: boolean;
  in_person_signing: boolean;
  representation_status: string;
  display_name: string;
  person: {
    person_id: string;
    first_name: string;
    last_name: string;
    middle_name: string | null;
    date_of_birth: string | null;
    preferred_language: string;
  } | null;
  incident: {
    date_of_loss: string;
    case_type_code: string;
    incident_city: string | null;
    incident_county: string | null;
    incident_location_description: string | null;
  } | null;
};

export type TeamMember = {
  assignment_role: string;
  staff_id: string;
  name: string;
  email: string | null;
};

export type TaskRow = {
  task_id: string;
  client_matter_id: string | null;
  title: string;
  description: string | null;
  task_type: string | null;
  due_date: string | null;
  priority: string | null;
  status: string;
  trigger_source: string | null;
  completion_method: string | null;
  override_reason: string | null;
  completed_at: string | null;
  matter_label?: string | null;
};

export type ProviderCallDue = {
  task_id: string;
  client_matter_id: string;
  display_name: string;
  due_date: string | null;
  owner_staff_id: string | null;
  treatment_episode_id: string;
  provider_name: string;
  approx_balance: number | null;
  balance_as_of: string | null;
  episode_status: string;
};

/** CM work queue: new cases awaiting sign-up processing (Michael 2026-07-22). */
export type NewCaseQueueRow = {
  client_matter_id: string;
  display_name: string;
  matter_number: string | null;
  date_of_loss: string | null;
  assigned_at: string;
  days_since_assignment: number;
  outstanding: string[];
};

/** CM work queue: incomplete Send-LOR checklist tasks. */
export type LorPendingQueueRow = {
  task_id: string;
  client_matter_id: string;
  display_name: string;
  matter_number: string | null;
  date_of_loss: string | null;
  task_title: string;
  claim_role: string | null;
  claim_number: string | null;
  claim_id: string | null;
  days_pending: number;
  due_date: string | null;
};

export type ClaimRow = {
  claim_id: string;
  claim_number: string | null;
  claim_role: string;
  status: string | null;
  policy_id: string | null;
  lor_sent_date: string | null;
};

export type CmQueueCounts = {
  newCases: number;
  lors: number;
};

export type TreatmentEpisodeRow = {
  treatment_episode_id: string;
  status: string;
  is_primary_pm: boolean;
  under_lop: boolean;
  approx_balance: number | null;
  balance_as_of: string | null;
  first_visit_date: string | null;
  last_visit_date: string | null;
  provider_id: string;
  provider_name: string | null;
  provider_type: string | null;
};

export function flagList(row: StalledRow): string[] {
  const flags: string[] = [];
  if (row.flag_missing_level) flags.push("Missing Level");
  if (row.flag_viability_overdue) flags.push("Viability overdue");
  if (row.flag_no_client_contact_30d) flags.push("No client contact 30d");
  if (row.flag_provider_check_overdue) flags.push("Provider call overdue");
  if (row.flag_treatment_compliance) flags.push("Treatment concern");
  if (row.flag_records_not_ordered) flags.push("Records not ordered");
  if (row.flag_pd_unresolved) flags.push("PD unresolved");
  if (row.flag_demand_response_overdue) flags.push("Demand response overdue");
  if (row.flag_dps_record_outstanding) flags.push("DPS outstanding");
  if (row.flag_public_records_outstanding) flags.push("Public records");
  if (row.flag_disbursement_aging) flags.push("Disbursement aging");
  if (row.flag_sol_within_120d) flags.push("SOL < 120d");
  return flags;
}

export function needsAttention(row: StalledRow): boolean {
  return flagList(row).length > 0;
}
