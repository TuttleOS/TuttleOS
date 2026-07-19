"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStaff } from "@/lib/staff-server";
import { digitsOnly, phoneForStorage } from "@/lib/intake/phone";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

async function requireStaff() {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("Not signed in or staff not linked");
  return staff;
}

function canSoftDelete(staff: {
  is_attorney: boolean;
  role_code: string;
}): boolean {
  return staff.is_attorney || staff.role_code === "admin";
}

function normalizeConfirm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Supersede primary phone/email; keep prior row for visible history. */
export async function updatePersonContactAction(input: {
  personId: string;
  kind: "phone" | "email";
  value: string;
  matterId?: string;
  leadId?: string;
}): Promise<ActionResult> {
  try {
    await requireStaff();
    const raw = input.value.trim();
    if (!raw) return { ok: false, error: "Value required" };

    const supabase = createClient();
    const today = new Date().toISOString().slice(0, 10);

    const { data: currentRows, error: readErr } = await supabase
      .schema("core")
      .from("contact_point")
      .select(
        "contact_point_id, phone, email, is_primary, kind",
      )
      .eq("person_id", input.personId)
      .eq("kind", input.kind)
      .is("deleted_at", null);
    if (readErr) return { ok: false, error: readErr.message };

    const current =
      currentRows?.find((r) => r.is_primary) ?? currentRows?.[0] ?? null;
    const nextValue =
      input.kind === "phone"
        ? phoneForStorage("US", digitsOnly(raw))
        : raw.toLowerCase();
    if (input.kind === "phone" && digitsOnly(raw).length !== 10) {
      return { ok: false, error: "Phone must be 10 digits" };
    }
    const same =
      current &&
      (input.kind === "phone"
        ? (current.phone ?? "").replace(/\D/g, "") ===
          nextValue.replace(/\D/g, "")
        : String(current.email ?? "").toLowerCase() === nextValue);
    if (same) return { ok: true, message: "No change" };

    if (current) {
      const { error: closeErr } = await supabase
        .schema("core")
        .from("contact_point")
        .update({
          is_primary: false,
          valid_to: today,
          deleted_at: new Date().toISOString(),
        })
        .eq("contact_point_id", current.contact_point_id);
      if (closeErr) return { ok: false, error: closeErr.message };
    }

    const insertRow =
      input.kind === "phone"
        ? {
            person_id: input.personId,
            kind: "phone" as const,
            phone: nextValue,
            is_primary: true,
            valid_from: today,
          }
        : {
            person_id: input.personId,
            kind: "email" as const,
            email: nextValue,
            is_primary: true,
            valid_from: today,
          };

    const { error: insErr } = await supabase
      .schema("core")
      .from("contact_point")
      .insert(insertRow);
    if (insErr) return { ok: false, error: insErr.message };

    if (input.matterId) {
      revalidatePath(`/cases/${input.matterId}`);
      revalidatePath(`/litigation/${input.matterId}`);
    }
    if (input.leadId) {
      revalidatePath(`/intake/leads/${input.leadId}`);
      revalidatePath("/intake");
    }
    return {
      ok: true,
      message:
        input.kind === "phone"
          ? "Phone updated — prior number kept in history"
          : "Email updated — prior address kept in history",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function softDeleteMatterAction(input: {
  matterId: string;
  confirmText: string;
}): Promise<ActionResult> {
  try {
    const staff = await requireStaff();
    if (!canSoftDelete(staff)) {
      return { ok: false, error: "Only attorney or admin may delete matters" };
    }

    const supabase = createClient();
    const { data: matter, error } = await supabase
      .schema("core")
      .from("client_matter")
      .select(
        "client_matter_id, matter_number, person:client_person_id(last_name)",
      )
      .eq("client_matter_id", input.matterId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!matter) return { ok: false, error: "Matter not found" };

    const personRel = matter.person as
      | { last_name: string }
      | { last_name: string }[]
      | null;
    const person = Array.isArray(personRel) ? personRel[0] : personRel;
    const allowed = [
      matter.matter_number,
      person?.last_name,
    ]
      .filter(Boolean)
      .map((s) => normalizeConfirm(String(s)));

    if (!allowed.includes(normalizeConfirm(input.confirmText))) {
      return {
        ok: false,
        error: "Confirmation must match client last name or matter number",
      };
    }

    const { error: delErr } = await supabase
      .schema("core")
      .from("client_matter")
      .update({ deleted_at: new Date().toISOString() })
      .eq("client_matter_id", input.matterId);
    if (delErr) return { ok: false, error: delErr.message };

    revalidatePath("/cases");
    revalidatePath("/litigation");
    revalidatePath(`/cases/${input.matterId}`);
    revalidatePath(`/litigation/${input.matterId}`);
    return { ok: true, message: "Matter soft-deleted" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function softDeleteLeadAction(input: {
  leadId: string;
  confirmText: string;
}): Promise<ActionResult> {
  try {
    const staff = await requireStaff();
    if (!canSoftDelete(staff)) {
      return { ok: false, error: "Only attorney or admin may delete leads" };
    }

    const supabase = createClient();
    const { data: lead, error } = await supabase
      .schema("core")
      .from("intake_lead")
      .select(
        "intake_lead_id, raw_name, person:person_id(last_name)",
      )
      .eq("intake_lead_id", input.leadId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!lead) return { ok: false, error: "Lead not found" };

    const personRel = lead.person as
      | { last_name: string }
      | { last_name: string }[]
      | null;
    const person = Array.isArray(personRel) ? personRel[0] : personRel;
    const fromRaw =
      lead.raw_name?.trim().split(/\s+/).filter(Boolean).at(-1) ?? null;
    const allowed = [person?.last_name, fromRaw]
      .filter(Boolean)
      .map((s) => normalizeConfirm(String(s)));

    if (!allowed.includes(normalizeConfirm(input.confirmText))) {
      return {
        ok: false,
        error: "Confirmation must match the lead last name",
      };
    }

    const { error: delErr } = await supabase
      .schema("core")
      .from("intake_lead")
      .update({ deleted_at: new Date().toISOString() })
      .eq("intake_lead_id", input.leadId);
    if (delErr) return { ok: false, error: delErr.message };

    revalidatePath("/intake");
    revalidatePath(`/intake/leads/${input.leadId}`);
    return { ok: true, message: "Lead soft-deleted" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
