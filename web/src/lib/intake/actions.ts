"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStaff } from "@/lib/staff-server";
import { defaultClientRole } from "./case-types";
import { formToGate } from "./gate";
import { digitsOnly, phoneForStorage, type PhoneCountry } from "./phone";
import { estimateSolIso } from "./sol";
import type { LeadFormInput, LeadStatus, LeadTemperature } from "./types";

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

    const companions = (input.companions ?? []).filter((c) =>
      c.full_name.trim(),
    );

    let incidentGroupId: string | null = null;
    if (input.same_crash_as_lead_id) {
      const resolved = await resolveOrCreateSharedIncidentGroup(
        supabase,
        input.same_crash_as_lead_id,
        {
          incident_date: input.incident_date,
          case_type_code: input.case_type_code,
          location: input.location,
        },
      );
      if (!resolved.ok) return resolved;
      incidentGroupId = resolved.incidentGroupId;
    } else if (companions.length > 0) {
      const created = await createIncidentGroupFromForm(supabase, {
        incident_date: input.incident_date,
        case_type_code: input.case_type_code,
        location: input.location,
        multiple: true,
      });
      if (!created.ok) return created;
      incidentGroupId = created.incidentGroupId;
    }

    const lang =
      input.preferred_language === "es"
        ? "es"
        : input.preferred_language === "other"
          ? "other"
          : "en";

    const dob = normalizeDob(input.date_of_birth);

    const { data: person, error: pErr } = await supabase
      .schema("core")
      .from("person")
      .insert({
        first_name: input.first_name.trim() || "Unknown",
        middle_name: input.middle_name?.trim() || null,
        last_name: input.last_name.trim() || "Unknown",
        suffix: input.suffix?.trim() || null,
        goes_by: input.goes_by?.trim() || null,
        date_of_birth: dob,
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
        incident_group_id: incidentGroupId,
      })
      .select("intake_lead_id")
      .single();

    if (lErr || !lead) {
      return { ok: false, error: lErr?.message ?? "Could not create lead" };
    }

    let companionCount = 0;
    for (const c of companions) {
      const names = splitFullName(c.full_name);
      const cDob = normalizeDob(c.date_of_birth);
      const { data: cPerson, error: cpErr } = await supabase
        .schema("core")
        .from("person")
        .insert({
          first_name: names.first,
          last_name: names.last,
          date_of_birth: cDob,
          preferred_language: lang,
        })
        .select("person_id")
        .single();
      if (cpErr || !cPerson) {
        return {
          ok: false,
          error: cpErr?.message ?? `Could not create companion ${c.full_name}`,
        };
      }

      const cEmail = c.email?.trim() || "";
      if (cEmail) {
        const { error: cemErr } = await supabase
          .schema("core")
          .from("contact_point")
          .insert({
            person_id: cPerson.person_id,
            kind: "email",
            email: cEmail,
            is_primary: true,
          });
        if (cemErr) return { ok: false, error: cemErr.message };
      }

      const { data: cLead, error: clErr } = await supabase
        .schema("core")
        .from("intake_lead")
        .insert({
          person_id: cPerson.person_id,
          raw_name: c.full_name.trim(),
          raw_email: cEmail || null,
          incident_date: input.incident_date || null,
          case_type_code: input.case_type_code || null,
          description,
          marketing_source: input.marketing_source?.trim() || null,
          estimated_sol_date: estimateSolIso(input.incident_date || null),
          status: "open",
          handled_by: staff.staff_id,
          incident_group_id: incidentGroupId,
        })
        .select("intake_lead_id")
        .single();
      if (clErr || !cLead) {
        return {
          ok: false,
          error: clErr?.message ?? `Could not save companion ${c.full_name}`,
        };
      }

      await supabase.schema("workflow").from("communication_log").insert({
        intake_lead_id: cLead.intake_lead_id,
        person_id: cPerson.person_id,
        staff_id: staff.staff_id,
        channel: "portal",
        direction: "inbound",
        summary: `Companion lead created with ${input.first_name} ${input.last_name}`.trim(),
      });
      companionCount += 1;
    }

    await supabase.schema("workflow").from("communication_log").insert({
      intake_lead_id: lead.intake_lead_id,
      person_id: person.person_id,
      staff_id: staff.staff_id,
      channel: "portal",
      direction: "inbound",
      summary:
        companionCount > 0
          ? `Lead created with ${companionCount} companion${companionCount === 1 ? "" : "s"} on same crash`
          : incidentGroupId
            ? "Lead created and linked to same crash as companion lead"
            : "Lead created in Intake workspace",
    });

    revalidatePath("/intake");
    return {
      ok: true,
      id: lead.intake_lead_id,
      message:
        companionCount > 0
          ? `Saved primary + ${companionCount} companion lead${companionCount === 1 ? "" : "s"}`
          : "Lead saved",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

type Sb = ReturnType<typeof createClient>;

function normalizeDob(raw?: string | null): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  // Accept YYYY-MM-DD from <input type="date">
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return null;
}

function splitFullName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "Unknown", last: "Unknown" };
  if (parts.length === 1) return { first: parts[0], last: "Unknown" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

async function createIncidentGroupFromForm(
  supabase: Sb,
  input: {
    incident_date: string;
    case_type_code: string;
    location: string;
    multiple?: boolean;
  },
): Promise<
  | { ok: true; incidentGroupId: string }
  | { ok: false; error: string }
> {
  if (!input.incident_date || !input.case_type_code) {
    return {
      ok: false,
      error: "Incident date and type required to link multiple people",
    };
  }
  const loc = input.location.trim();
  if (!loc) {
    return {
      ok: false,
      error: "Location required to link multiple people on one crash",
    };
  }
  const { data: ig, error } = await supabase
    .schema("core")
    .from("incident_group")
    .insert({
      date_of_loss: input.incident_date,
      case_type_code: input.case_type_code,
      incident_city: loc.length < 40 ? loc : null,
      incident_location_description: loc.length >= 40 ? loc : loc,
      incident_state: "TX",
      multiple_clients: Boolean(input.multiple),
    })
    .select("incident_group_id")
    .single();
  if (error || !ig) {
    return { ok: false, error: error?.message ?? "Could not create shared crash" };
  }
  return { ok: true, incidentGroupId: ig.incident_group_id as string };
}

async function resolveOrCreateSharedIncidentGroup(
  supabase: Sb,
  anchorLeadId: string,
  fallback: {
    incident_date: string;
    case_type_code: string;
    location: string;
  },
): Promise<
  | { ok: true; incidentGroupId: string }
  | { ok: false; error: string }
> {
  const { data: anchor, error } = await supabase
    .schema("core")
    .from("intake_lead")
    .select(
      "intake_lead_id, incident_date, case_type_code, description, incident_group_id, resulting_matter_id",
    )
    .eq("intake_lead_id", anchorLeadId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !anchor) {
    return { ok: false, error: "Companion lead not found" };
  }

  if (anchor.incident_group_id) {
    return { ok: true, incidentGroupId: anchor.incident_group_id as string };
  }

  if (anchor.resulting_matter_id) {
    const { data: matter } = await supabase
      .schema("core")
      .from("client_matter")
      .select("incident_group_id")
      .eq("client_matter_id", anchor.resulting_matter_id)
      .maybeSingle();
    if (matter?.incident_group_id) {
      await supabase
        .schema("core")
        .from("intake_lead")
        .update({ incident_group_id: matter.incident_group_id })
        .eq("intake_lead_id", anchorLeadId);
      return { ok: true, incidentGroupId: matter.incident_group_id as string };
    }
  }

  const doi = (anchor.incident_date as string | null) || fallback.incident_date;
  const caseType =
    (anchor.case_type_code as string | null) || fallback.case_type_code;
  const locFromAnchor = String(anchor.description ?? "")
    .split("\n")
    .filter((line) => !line.startsWith("[in-person"))
    .join(" ")
    .trim();
  const loc = locFromAnchor || fallback.location.trim();

  if (!doi || !caseType) {
    return {
      ok: false,
      error:
        "Companion lead needs an incident date and type before linking (or fill them on this form)",
    };
  }
  if (!loc) {
    return {
      ok: false,
      error: "Companion lead needs a location before linking (or enter one here)",
    };
  }

  const { data: ig, error: igErr } = await supabase
    .schema("core")
    .from("incident_group")
    .insert({
      date_of_loss: doi,
      case_type_code: caseType,
      incident_city: loc.length < 40 ? loc : null,
      incident_location_description: loc.length >= 40 ? loc : loc,
      incident_state: "TX",
      multiple_clients: true,
    })
    .select("incident_group_id")
    .single();
  if (igErr || !ig) {
    return { ok: false, error: igErr?.message ?? "Could not create shared crash" };
  }

  await supabase
    .schema("core")
    .from("intake_lead")
    .update({ incident_group_id: ig.incident_group_id })
    .eq("intake_lead_id", anchorLeadId);

  return { ok: true, incidentGroupId: ig.incident_group_id as string };
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

export async function updateLeadTemperatureAction(
  leadId: string,
  temperature: LeadTemperature | null,
): Promise<ActionResult> {
  try {
    const staff = await requireStaff();
    if (temperature !== null && !["hot", "warm", "cold"].includes(temperature)) {
      return { ok: false, error: "Invalid temperature" };
    }
    const supabase = createClient();
    const { error } = await supabase
      .schema("core")
      .from("intake_lead")
      .update({ lead_temperature: temperature })
      .eq("intake_lead_id", leadId);
    if (error) return { ok: false, error: error.message };

    await supabase.schema("workflow").from("communication_log").insert({
      intake_lead_id: leadId,
      staff_id: staff.staff_id,
      channel: "portal",
      direction: "outbound",
      summary: temperature
        ? `Lead temperature → ${temperature}`
        : "Lead temperature cleared",
    });

    revalidatePath("/intake");
    revalidatePath(`/intake/leads/${leadId}`);
    return {
      ok: true,
      message: temperature
        ? `Marked ${temperature}`
        : "Temperature cleared",
    };
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
        "intake_lead_id, person_id, incident_date, case_type_code, description, status, resulting_matter_id, raw_phone, raw_email, incident_group_id",
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

    let incidentGroupId = (lead.incident_group_id as string | null) ?? null;
    if (incidentGroupId) {
      await supabase
        .schema("core")
        .from("incident_group")
        .update({ multiple_clients: true })
        .eq("incident_group_id", incidentGroupId);
    } else {
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
      if (igErr || !ig) {
        return { ok: false, error: igErr?.message ?? "Could not create incident" };
      }
      incidentGroupId = ig.incident_group_id as string;
      await supabase
        .schema("core")
        .from("intake_lead")
        .update({ incident_group_id: incidentGroupId })
        .eq("intake_lead_id", leadId);
    }

    const matterNumber = `INT-${lead.intake_lead_id.slice(0, 8).toUpperCase()}`;

    const { data: matter, error: mErr } = await supabase
      .schema("core")
      .from("client_matter")
      .insert({
        incident_group_id: incidentGroupId,
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
