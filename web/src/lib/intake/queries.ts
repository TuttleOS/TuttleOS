import { createClient } from "@/lib/supabase/server";
import type { LeadRow, LeadStatus } from "./types";

const LEAD_SELECT = `
  intake_lead_id, person_id, raw_name, raw_phone, raw_email, contact_date,
  incident_date, case_type_code, description, intake_source, marketing_source,
  estimated_sol_date, status, rejected_reason, non_engagement_letter_sent_date,
  handled_by, resulting_matter_id, created_at, updated_at, deleted_at,
  person:person_id(person_id, first_name, middle_name, last_name, suffix, goes_by, preferred_language)
`;

export async function listLeads(status?: LeadStatus | "all"): Promise<LeadRow[]> {
  const supabase = createClient();
  let q = supabase
    .schema("core")
    .from("intake_lead")
    .select(LEAD_SELECT)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (status && status !== "all") {
    q = q.eq("status", status);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LeadRow[];
}

export async function getLead(id: string): Promise<LeadRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("core")
    .from("intake_lead")
    .select(LEAD_SELECT)
    .eq("intake_lead_id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as LeadRow | null;
}

export async function getPersonContacts(personId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("core")
    .from("contact_point")
    .select("contact_point_id, kind, phone, phone_e164, email, is_primary")
    .eq("person_id", personId);
  if (error) throw new Error(error.message);
  const phone = data?.find((c) => c.kind === "phone");
  const email = data?.find((c) => c.kind === "email");
  return { phone, email, all: data ?? [] };
}

export async function listLeadAttempts(leadId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("workflow")
    .from("communication_log")
    .select(
      "communication_log_id, channel, direction, summary, occurred_at, staff_id, call_status",
    )
    .eq("intake_lead_id", leadId)
    .order("occurred_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listMyIntakeActivity(staffId: string, limit = 30) {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("workflow")
    .from("communication_log")
    .select(
      "communication_log_id, intake_lead_id, summary, occurred_at, channel, direction",
    )
    .eq("staff_id", staffId)
    .not("intake_lead_id", "is", null)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

