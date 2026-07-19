export type LeadTemperature = "hot" | "warm" | "cold";

export const LEAD_TEMPERATURE_META: Record<
  LeadTemperature,
  { label: string; chip: string }
> = {
  hot: { label: "Hot", chip: "bg-danger-bg text-danger border-danger/30" },
  warm: { label: "Warm", chip: "bg-warning-bg text-warning border-warning/30" },
  cold: { label: "Cold", chip: "bg-surface-2 text-muted border-grid" },
};

export type LeadStatus =
  | "open"
  | "contract_sent"
  | "signed"
  | "rejected"
  | "referred_out"
  | "no_response"
  | "duplicate";

export const LEAD_STATUS_META: Record<
  LeadStatus,
  { label: string; icon: string; chip: string }
> = {
  open: { label: "Open — working", icon: "●", chip: "bg-info-bg text-info" },
  contract_sent: {
    label: "Contract out",
    icon: "✉",
    chip: "bg-warning-bg text-warning",
  },
  signed: { label: "Signed → matter", icon: "✔", chip: "bg-success-bg text-success" },
  rejected: { label: "Rejected", icon: "✕", chip: "bg-danger-bg text-danger" },
  referred_out: { label: "Referred out", icon: "→", chip: "bg-surface-2 text-muted" },
  no_response: { label: "No response", icon: "…", chip: "bg-surface-2 text-muted" },
  duplicate: { label: "Duplicate", icon: "=", chip: "bg-surface-2 text-muted" },
};

export type LeadPerson = {
  person_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  goes_by: string | null;
  preferred_language: string;
};

export type LeadRow = {
  intake_lead_id: string;
  person_id: string | null;
  raw_name: string | null;
  raw_phone: string | null;
  raw_email: string | null;
  contact_date: string;
  incident_date: string | null;
  case_type_code: string | null;
  description: string | null;
  intake_source: string | null;
  marketing_source: string | null;
  estimated_sol_date: string | null;
  status: LeadStatus;
  lead_temperature: LeadTemperature | null;
  rejected_reason: string | null;
  non_engagement_letter_sent_date: string | null;
  handled_by: string | null;
  resulting_matter_id: string | null;
  incident_group_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  person?: LeadPerson | null;
  /** Live primary phone from contact_point (preferred over raw_phone for gate/UI). */
  primary_phone?: string | null;
  /** Live primary email from contact_point (preferred over raw_email for gate/UI). */
  primary_email?: string | null;
};

export type CompanionFormInput = {
  full_name: string;
  email?: string;
  date_of_birth?: string;
};

export type LeadFormInput = {
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  goes_by?: string;
  date_of_birth?: string;
  case_type_code: string;
  incident_date: string;
  location: string;
  phone_country: "US" | "MX";
  phone_digits: string;
  email: string;
  in_person_signing: boolean;
  preferred_language: "en" | "es" | "other";
  marketing_source?: string;
  /** Extra people on the same crash — each becomes their own linked lead. */
  companions?: CompanionFormInput[];
  /** Link onto an existing lead’s crash (advanced). */
  same_crash_as_lead_id?: string | null;
  partial?: boolean;
};

export type GateItem = {
  key: string;
  label: string;
  ok: boolean;
  fieldId: string;
  value: string;
};
