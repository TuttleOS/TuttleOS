"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStaff } from "@/lib/staff-server";
import { defaultClientRole } from "./case-types";
import { formToGate } from "./gate";
import { digitsOnly, phoneForStorage, type PhoneCountry } from "./phone";
import { estimateSolIso } from "./sol";
import type { LeadFormInput, LeadStatus } from "./types";

async function requireStaff() {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("Not signed in or staff not linked");
  return staff;
}

export type ActionResult =
  | { ok: true; id?: string; message?: string }
  | { ok: false; error: string };

export async function createLeadAction(
  input: LeadFormInput,
): Promise<ActionResult> {
  try {
    const staff = await requireStaff();
    const supabase = createClient();
    const gate = formToGate(input);

    if (!input.partial && !gate.ready) {
      return {
        ok: false,
        error: `Gate incomplete: ${gate.missing.map((m) => m.label).join(", ")}`,
      };
    }

    const lang =
      input.preferred_language === "es"
        ? "es"
        : input.preferred_language === "other"
          ? "other"
          : "en";

    const { data: person, error: pErr } = await supabase
      .schema("core")
      .from("person")
      .insert({
        first_name: input.first_name.trim() || "Unknown",
        middle_name: input.middle_name?.trim() || null,
        last_name: input.last_name.trim() || "Unknown",
        suffix: input.suffix?.trim() || null,
        goes_by: input.goes_by?.trim() || null,
        preferred_language: lang,
      })
      .select("person_id")
      .single();

    if (pErr || !person) {
      return { ok: false, error: pErr?.message ?? "Could not create person" };
    }

    const digits = digitsOnly(input.phone_digits);
    if (digits.length > 0) {
      const { error: phErr } = await supabase
        .schema("core")
        .from("contact_point")
        .insert({
          person_id: person.person_id,
          kind: "phone",
          phone: phoneForStorage(input.phone_country as PhoneCountry, digits),
          is_primary: true,
        });
      if (phErr) return { ok: false, error: phErr.message };
    }

    if (input.email.trim()) {
      const { error: emErr } = await supabase
        .schema("core")
        .from("contact_point")
        .insert({
          person_id: person.person_id,
          kind: "email",
          email: input.email.trim(),
          is_primary: true,
        });
      if (emErr) return { ok: false, error: emErr.message };
    }

    let description = input.location.trim() || null;
    if (input.in_person_signing) {
      description = [
        description,
        "[in-person signing: email waived — audit via staff action]",
      ]
        .filter(Boolean)
        .join("\n");
    }

    const { data: lead, error: lErr } = await supabase
      .schema("core")
      .from("intake_lead")
      .insert({
        person_id: person.person_id,
        raw_name: `${input.first_name} ${input.last_name}`.trim(),
        raw_phone: digits || null,
        raw_email: input.email.trim() || null,
        incident_date: input.incident_date || null,
        case_type_code: input.case_type_code || null,
        description,
        marketing_source: input.marketing_source?.trim() || null,
        estimated_sol_date: estimateSolIso(input.incident_date || null),
        status: "open",
        handled_by: staff.staff_id,
      })
      .select("intake_lead_id")
      .single();

    if (lErr || !lead) {
      return { ok: false, error: lErr?.message ?? "Could not create lead" };
    }

    await supabase.schema("workflow").from("communication_log").insert({
      intake_lead_id: lead.intake_lead_id,
      person_id: person.person_id,
      staff_id: staff.staff_id,
      channel: "portal",
      direction: "inbound",
      summary: "Lead created in Intake workspace",
    });

    revalidatePath("/intake");
    return { ok: true, id: lead.intake_lead_id, message: "Lead saved" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function updateLeadStatusAction(
  leadId: string,
  status: LeadStatus,
  extras?: { rejected_reason?: string },
): Promise<ActionResult> {
  try {
    const staff = await requireStaff();
    const supabase = createClient();
    const patch: Record<string, unknown> = { status };
    if (status === "rejected") {
      patch.rejected_reason = extras?.rejected_reason ?? "Rejected at intake";
    }
    const { error } = await supabase
      .schema("core")
      .from("intake_lead")
      .update(patch)
      .eq("intake_lead_id", leadId);
    if (error) return { ok: false, error: error.message };

    await supabase.schema("workflow").from("communication_log").insert({
      intake_lead_id: leadId,
      staff_id: staff.staff_id,
      channel: "portal",
      direction: "outbound",
      summary:
        status === "rejected"
          ? `Rejected at intake. NON-ENGAGEMENT LETTER NOT YET SENT${extras?.rejected_reason ? ` — ${extras.rejected_reason}` : ""}`
          : status === "contract_sent"
            ? "Contract marked sent (e-sign stub)"
            : status === "signed"
              ? "Contract marked signed — ready to open matter"
              : `Status → ${status}`,
    });

    revalidatePath("/intake");
    revalidatePath(`/intake/leads/${leadId}`);
    return { ok: true, message: `Status updated to ${status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function sendNelAction(leadId: string): Promise<ActionResult> {
  try {
    const staff = await requireStaff();
    const supabase = createClient();
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .schema("core")
      .from("intake_lead")
      .update({ non_engagement_letter_sent_date: today })
      .eq("intake_lead_id", leadId);
    if (error) return { ok: false, error: error.message };

    await supabase.schema("workflow").from("communication_log").insert({
      intake_lead_id: leadId,
      staff_id: staff.staff_id,
      channel: "letter",
      direction: "outbound",
      summary: "Non-engagement letter generated & sent (logged)",
    });

    revalidatePath("/intake");
    revalidatePath(`/intake/leads/${leadId}`);
    return { ok: true, message: "Non-engagement letter recorded" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function logAttemptAction(
  leadId: string,
  summary: string,
  channel: "call" | "sms" | "email" | "voicemail" = "call",
): Promise<ActionResult> {
  try {
    const staff = await requireStaff();
    if (!summary.trim()) return { ok: false, error: "Attempt text required" };
    const supabase = createClient();
    const { data: lead } = await supabase
      .schema("core")
      .from("intake_lead")
      .select("person_id")
      .eq("intake_lead_id", leadId)
      .single();

    const { error } = await supabase.schema("workflow").from("communication_log").insert({
      intake_lead_id: leadId,
      person_id: lead?.person_id ?? null,
      staff_id: staff.staff_id,
      channel,
      direction: "outbound",
      summary: summary.trim(),
      call_status: channel === "call" ? "completed" : null,
    });
    if (error) return { ok: false, error: error.message };

    revalidatePath(`/intake/leads/${leadId}`);
    revalidatePath("/intake");
    revalidatePath("/intake/activity");
    return { ok: true, message: "Attempt logged" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function convertLeadToMatterAction(
  leadId: string,
  opts?: { in_person_signing?: boolean },
): Promise<ActionResult> {
  try {
    const staff = await requireStaff();
    const supabase = createClient();

    const { data: lead, error: lErr } = await supabase
      .schema("core")
      .from("intake_lead")
      .select(
        "intake_lead_id, person_id, incident_date, case_type_code, description, status, resulting_matter_id, raw_phone, raw_email",
      )
      .eq("intake_lead_id", leadId)
      .single();

    if (lErr || !lead) return { ok: false, error: lErr?.message ?? "Lead not found" };
    if (lead.resulting_matter_id) {
      return { ok: true, id: lead.resulting_matter_id, message: "Matter already opened" };
    }
    if (lead.status !== "signed") {
      return { ok: false, error: "Lead must be marked signed before opening a matter" };
    }
    if (!lead.person_id) return { ok: false, error: "Lead has no person record" };
    if (!lead.incident_date || !lead.case_type_code) {
      return { ok: false, error: "Incident date and type required to open a matter" };
    }

    const { data: contacts } = await supabase
      .schema("core")
      .from("contact_point")
      .select("kind, phone, email")
      .eq("person_id", lead.person_id);

    const hasPhone = contacts?.some((c) => c.kind === "phone" && c.phone);
    const hasEmail = contacts?.some((c) => c.kind === "email" && c.email);
    const inPerson = !!opts?.in_person_signing || /in-person signing/i.test(lead.description ?? "");

    if (!hasPhone) return { ok: false, error: "Client phone required before opening a matter" };
    if (!hasEmail && !inPerson) {
      return { ok: false, error: "Client email required (or in-person signing)" };
    }

    const loc = (lead.description ?? "")
      .split("\n")
      .filter((line: string) => !line.startsWith("[in-person"))
      .join(" ")
      .trim();
    if (!loc) {
      return { ok: false, error: "Injury location required before opening a matter" };
    }

    const { data: ig, error: igErr } = await supabase
      .schema("core")
      .from("incident_group")
      .insert({
        date_of_loss: lead.incident_date,
        case_type_code: lead.case_type_code,
        incident_city: loc.length < 40 ? loc : null,
        incident_location_description: loc.length >= 40 ? loc : loc,
        incident_state: "TX",
      })
      .select("incident_group_id")
      .single();

    if (igErr || !ig) return { ok: false, error: igErr?.message ?? "Could not create incident" };

    const matterNumber = `INT-${lead.intake_lead_id.slice(0, 8).toUpperCase()}`;

    const { data: matter, error: mErr } = await supabase
      .schema("core")
      .from("client_matter")
      .insert({
        incident_group_id: ig.incident_group_id,
        client_person_id: lead.person_id,
        matter_number: matterNumber,
        client_role: defaultClientRole(lead.case_type_code),
        current_stage_code: "intake",
        in_person_signing: inPerson,
        sign_up_date: new Date().toISOString().slice(0, 10),
        contract_signed_date: new Date().toISOString().slice(0, 10),
        sol_date: estimateSolIso(lead.incident_date),
        sol_status: "needs_review",
      })
      .select("client_matter_id")
      .single();

    if (mErr || !matter) {
      return { ok: false, error: mErr?.message ?? "Could not open matter (check six minimums)" };
    }

    const { error: uErr } = await supabase
      .schema("core")
      .from("intake_lead")
      .update({
        status: "signed",
        resulting_matter_id: matter.client_matter_id,
      })
      .eq("intake_lead_id", leadId);

    if (uErr) return { ok: false, error: uErr.message };

    await supabase.schema("workflow").from("communication_log").insert({
      intake_lead_id: leadId,
      client_matter_id: matter.client_matter_id,
      person_id: lead.person_id,
      staff_id: staff.staff_id,
      channel: "portal",
      direction: "outbound",
      summary: `Matter opened ${matterNumber} — handed to Case Manager path`,
    });

    revalidatePath("/intake");
    revalidatePath(`/intake/leads/${leadId}`);
    revalidatePath("/cases");
    revalidatePath(`/cases/${matter.client_matter_id}`);
    return {
      ok: true,
      id: matter.client_matter_id,
      message: `Matter ${matterNumber} opened`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
