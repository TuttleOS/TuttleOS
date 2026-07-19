import { createClient } from "@/lib/supabase/server";
import type { LeadRow, LeadStatus } from "./types";

const LEAD_SELECT = `
  intake_lead_id, person_id, raw_name, raw_phone, raw_email, contact_date,
  incident_date, case_type_code, description, intake_source, marketing_source,
  estimated_sol_date, status, lead_temperature, rejected_reason, non_engagement_letter_sent_date,
  handled_by, resulting_matter_id, incident_group_id, created_at, updated_at, deleted_at,
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
  return enrichLeadsWithContacts((data ?? []) as unknown as LeadRow[]);
}

/** Overlay primary phone/email from contact_point so queue gate matches lead detail. */
async function enrichLeadsWithContacts(leads: LeadRow[]): Promise<LeadRow[]> {
  const personIds = Array.from(
    new Set(
      leads
        .map((l) => l.person_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );
  if (personIds.length === 0) return leads;

  const supabase = createClient();
  const { data: points, error } = await supabase
    .schema("core")
    .from("contact_point")
    .select("person_id, kind, phone, phone_e164, email, is_primary")
    .in("person_id", personIds)
    .in("kind", ["phone", "email"])
    .is("deleted_at", null)
    .order("is_primary", { ascending: false });
  if (error || !points?.length) return leads;

  const byPerson = new Map<string, { phone?: string; email?: string }>();
  for (const p of points) {
    const cur = byPerson.get(p.person_id) ?? {};
    if (p.kind === "phone" && !cur.phone) {
      cur.phone = (p.phone_e164 ?? p.phone ?? undefined) || undefined;
    }
    if (p.kind === "email" && !cur.email) {
      cur.email = p.email ?? undefined;
    }
    byPerson.set(p.person_id, cur);
  }

  return leads.map((l) => {
    if (!l.person_id) return l;
    const c = byPerson.get(l.person_id);
    if (!c) return l;
    return {
      ...l,
      primary_phone: c.phone ?? null,
      primary_email: c.email ?? null,
    };
  });
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
    .select(
      "contact_point_id, kind, phone, phone_e164, email, is_primary, address_line1, address_line2, city, state, zip",
    )
    .eq("person_id", personId)
    .is("deleted_at", null)
    .order("is_primary", { ascending: false });
  if (error) throw new Error(error.message);
  const phone =
    data?.find((c) => c.kind === "phone" && c.is_primary) ??
    data?.find((c) => c.kind === "phone");
  const email =
    data?.find((c) => c.kind === "email" && c.is_primary) ??
    data?.find((c) => c.kind === "email");
  const address =
    data?.find((c) => c.kind === "address" && c.is_primary) ??
    data?.find((c) => c.kind === "address");
  return { phone, email, address, all: data ?? [] };
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

/** Open / in-flight leads staff can attach a new person to as same-crash companions. */
export async function listLinkableLeadsForCrash(limit = 40) {
  const leads = await listLeads("all");
  return leads
    .filter((l) =>
      ["open", "contract_sent", "signed"].includes(l.status),
    )
    .slice(0, limit)
    .map((l) => {
      const p = l.person;
      const name = p
        ? `${p.last_name}, ${p.first_name}`
        : l.raw_name || "Unnamed lead";
      return {
        intake_lead_id: l.intake_lead_id,
        name,
        incident_date: l.incident_date,
        case_type_code: l.case_type_code,
        location:
          (l.description ?? "")
            .split("\n")
            .filter((line) => !line.startsWith("[in-person"))
            .join(" ")
            .trim() || null,
        status: l.status,
      };
    });
}

export async function listCompanionLeadsForGroup(
  incidentGroupId: string,
  excludeLeadId?: string,
): Promise<LeadRow[]> {
  const supabase = createClient();
  let q = supabase
    .schema("core")
    .from("intake_lead")
    .select(LEAD_SELECT)
    .eq("incident_group_id", incidentGroupId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (excludeLeadId) q = q.neq("intake_lead_id", excludeLeadId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LeadRow[];
}

