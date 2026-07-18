"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStaff } from "@/lib/staff-server";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

async function requireStaff() {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("Not signed in or staff not linked");
  return staff;
}

export async function completeTaskAction(
  taskId: string,
  opts?: { override_reason?: string },
): Promise<ActionResult> {
  try {
    const staff = await requireStaff();
    const supabase = createClient();
    const patch: Record<string, unknown> = {
      status: "done",
      completed_at: new Date().toISOString(),
      completed_by: staff.staff_id,
      completion_method: opts?.override_reason ? "manual_override" : "manual",
    };
    if (opts?.override_reason) patch.override_reason = opts.override_reason;

    const { data, error } = await supabase
      .schema("workflow")
      .from("task")
      .update(patch)
      .eq("task_id", taskId)
      .select("client_matter_id")
      .single();
    if (error) return { ok: false, error: error.message };

    revalidatePath("/cases/tasks");
    if (data?.client_matter_id) {
      revalidatePath(`/cases/${data.client_matter_id}`);
    }
    revalidatePath("/cases");
    return { ok: true, message: "Task completed" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function reopenTaskAction(taskId: string): Promise<ActionResult> {
  try {
    await requireStaff();
    const supabase = createClient();
    const { data, error } = await supabase
      .schema("workflow")
      .from("task")
      .update({
        status: "open",
        completed_at: null,
        completed_by: null,
        completion_method: null,
        override_reason: null,
      })
      .eq("task_id", taskId)
      .select("client_matter_id")
      .single();
    if (error) return { ok: false, error: error.message };

    revalidatePath("/cases/tasks");
    if (data?.client_matter_id) {
      revalidatePath(`/cases/${data.client_matter_id}`);
    }
    return { ok: true, message: "Task reopened" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function createFollowUpTaskAction(input: {
  client_matter_id: string;
  title: string;
  due_date: string;
  priority?: string;
  description?: string;
  owner_staff_id?: string;
}): Promise<ActionResult> {
  try {
    const staff = await requireStaff();
    if (!input.title.trim()) return { ok: false, error: "Title required" };
    if (!input.due_date) return { ok: false, error: "Due date required" };

    const supabase = createClient();
    const { error } = await supabase.schema("workflow").from("task").insert({
      client_matter_id: input.client_matter_id,
      entity_id: input.client_matter_id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      due_date: input.due_date,
      priority: input.priority ?? "normal",
      status: "open",
      task_type: "follow_up",
      trigger_source: "client_call",
      owner_staff_id: input.owner_staff_id ?? staff.staff_id,
      created_by: staff.staff_id,
    });
    if (error) return { ok: false, error: error.message };

    revalidatePath(`/cases/${input.client_matter_id}`);
    revalidatePath("/cases/tasks");
    return { ok: true, message: "Follow-up created" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function addNoteAction(
  matterId: string,
  body: string,
  pinned = false,
): Promise<ActionResult> {
  try {
    const staff = await requireStaff();
    if (!body.trim()) return { ok: false, error: "Note required" };
    const supabase = createClient();
    const { error } = await supabase.schema("workflow").from("note").insert({
      entity_id: matterId,
      body: body.trim(),
      pinned,
      author_staff_id: staff.staff_id,
    });
    if (error) return { ok: false, error: error.message };

    revalidatePath(`/cases/${matterId}`);
    return { ok: true, message: "Note saved" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

/** Log a bi-weekly provider check → medical.provider_contact_log (+ trigger schedules next call). */
export async function logProviderCallAction(input: {
  treatment_episode_id: string;
  client_matter_id: string;
  task_id?: string;
  reached: boolean;
  treatment_confirmed?: boolean;
  approx_balance?: number | null;
  next_appointment_date?: string | null;
  gap_or_compliance_concern: boolean;
  note?: string;
  method?: "phone" | "portal" | "fax" | "email" | "in_person";
}): Promise<ActionResult> {
  try {
    const staff = await requireStaff();
    const supabase = createClient();

    const { error: logErr } = await supabase
      .schema("medical")
      .from("provider_contact_log")
      .insert({
        treatment_episode_id: input.treatment_episode_id,
        contacted_by: staff.staff_id,
        method: input.method ?? "phone",
        reached: input.reached,
        treatment_confirmed: input.treatment_confirmed ?? null,
        approx_balance:
          input.approx_balance != null && !Number.isNaN(input.approx_balance)
            ? input.approx_balance
            : null,
        next_appointment_date: input.next_appointment_date || null,
        gap_or_compliance_concern: input.gap_or_compliance_concern,
        note: input.note?.trim() || null,
      });
    if (logErr) return { ok: false, error: logErr.message };

    if (input.gap_or_compliance_concern) {
      await supabase
        .schema("medical")
        .from("treatment_episode")
        .update({ status: "gap_concern" })
        .eq("treatment_episode_id", input.treatment_episode_id)
        .in("status", ["scheduled", "active"]);
    }

    if (input.task_id) {
      await supabase
        .schema("workflow")
        .from("task")
        .update({
          status: "done",
          completed_at: new Date().toISOString(),
          completed_by: staff.staff_id,
          completion_method: "manual",
        })
        .eq("task_id", input.task_id)
        .in("status", ["open", "in_progress"]);
    }

    revalidatePath("/cases/calls");
    revalidatePath("/cases/tasks");
    revalidatePath("/cases");
    revalidatePath(`/cases/${input.client_matter_id}`);
    return {
      ok: true,
      message: "Provider call logged — next check scheduled in 14 days",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

function revalidateMatter(matterId: string) {
  revalidatePath(`/cases/${matterId}`);
  revalidatePath("/cases");
  revalidatePath("/cases/calls");
  revalidatePath("/demands");
}

export async function declareCoverageNaAction(input: {
  client_matter_id: string;
  category: string;
}): Promise<ActionResult> {
  try {
    const staff = await requireStaff();
    const supabase = createClient();
    const { error } = await supabase.schema("medical").from("coverage_na").upsert(
      {
        client_matter_id: input.client_matter_id,
        category: input.category,
        declared_by: staff.staff_id,
        declared_at: new Date().toISOString(),
      },
      { onConflict: "client_matter_id,category" },
    );
    if (error) return { ok: false, error: error.message };
    revalidateMatter(input.client_matter_id);
    return { ok: true, message: "Marked N/A" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function clearCoverageNaAction(input: {
  client_matter_id: string;
  category: string;
}): Promise<ActionResult> {
  try {
    await requireStaff();
    const supabase = createClient();
    const { error } = await supabase
      .schema("medical")
      .from("coverage_na")
      .delete()
      .eq("client_matter_id", input.client_matter_id)
      .eq("category", input.category);
    if (error) return { ok: false, error: error.message };
    revalidateMatter(input.client_matter_id);
    return { ok: true, message: "N/A cleared" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

/** Create org+provider (optional) and treatment episode. */
export async function addProviderEpisodeAction(input: {
  client_matter_id: string;
  provider_id?: string;
  new_provider_name?: string;
  provider_type: string;
  phone?: string;
  accepts_lop?: boolean;
  under_lop?: boolean;
  is_primary_pm?: boolean;
  coverage_category?: string;
}): Promise<ActionResult> {
  try {
    const staff = await requireStaff();
    const supabase = createClient();
    let providerId = input.provider_id ?? null;

    if (!providerId) {
      const name = input.new_provider_name?.trim();
      if (!name) return { ok: false, error: "Provider name required" };
      const { data: org, error: orgErr } = await supabase
        .schema("core")
        .from("organization")
        .insert({ name, org_type: "medical_provider" })
        .select("organization_id")
        .single();
      if (orgErr) return { ok: false, error: orgErr.message };

      if (input.phone?.trim()) {
        await supabase.schema("core").from("contact_point").insert({
          organization_id: org.organization_id,
          kind: "phone",
          label: "business",
          phone: input.phone.trim(),
          is_primary: true,
        });
      }

      const { data: prov, error: pErr } = await supabase
        .schema("medical")
        .from("provider")
        .insert({
          organization_id: org.organization_id,
          provider_type: input.provider_type,
          accepts_lop: input.accepts_lop ?? null,
        })
        .select("provider_id")
        .single();
      if (pErr) return { ok: false, error: pErr.message };
      providerId = prov.provider_id;
    }

    const { error: epErr } = await supabase
      .schema("medical")
      .from("treatment_episode")
      .insert({
        client_matter_id: input.client_matter_id,
        provider_id: providerId,
        status: "active",
        is_primary_pm: Boolean(input.is_primary_pm),
        under_lop: Boolean(input.under_lop),
        first_visit_date: new Date().toISOString().slice(0, 10),
      });
    if (epErr) return { ok: false, error: epErr.message };

    if (input.coverage_category) {
      await supabase
        .schema("medical")
        .from("coverage_na")
        .delete()
        .eq("client_matter_id", input.client_matter_id)
        .eq("category", input.coverage_category);
    }

    if (input.under_lop || input.accepts_lop) {
      await supabase.schema("workflow").from("note").insert({
        entity_id: input.client_matter_id,
        author_staff_id: staff.staff_id,
        note_type: "treatment",
        body: `Provider episode started${input.under_lop ? " — UNDER LOP (flag for attorney)" : ""}.`,
        pinned: Boolean(input.under_lop),
      });
    }

    revalidateMatter(input.client_matter_id);
    return { ok: true, message: "Provider episode added" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function startPdClaimAction(input: {
  client_matter_id: string;
  incident_group_id: string;
  year?: number | null;
  make: string;
  model: string;
  current_location: string;
  drivable?: boolean | null;
  storage_accruing?: boolean;
}): Promise<ActionResult> {
  try {
    const staff = await requireStaff();
    if (!input.make.trim() || !input.model.trim()) {
      return { ok: false, error: "Make and model required" };
    }
    if (!input.current_location.trim()) {
      return { ok: false, error: "Current location required (storage clock)" };
    }
    const supabase = createClient();
    const { data: vehicle, error: vErr } = await supabase
      .schema("property")
      .from("vehicle")
      .insert({
        incident_group_id: input.incident_group_id,
        year: input.year || null,
        make: input.make.trim(),
        model: input.model.trim(),
        current_location: input.current_location.trim(),
        drivable: input.drivable ?? null,
        storage_accruing: Boolean(input.storage_accruing),
        is_client_vehicle: true,
      })
      .select("vehicle_id")
      .single();
    if (vErr) return { ok: false, error: vErr.message };

    const today = new Date().toISOString().slice(0, 10);
    const { error: pErr } = await supabase.schema("property").from("pd_claim").insert({
      vehicle_id: vehicle.vehicle_id,
      status: "in_progress",
      owner_staff_id: staff.staff_id,
      opened_date: today,
      last_touch_date: today,
    });
    if (pErr) return { ok: false, error: pErr.message };

    await supabase.schema("workflow").from("note").insert({
      entity_id: input.client_matter_id,
      author_staff_id: staff.staff_id,
      note_type: "pd",
      body: `PD track started: ${input.year ?? ""} ${input.make} ${input.model} at ${input.current_location}${input.storage_accruing ? " — STORAGE CLOCK RUNNING" : ""}.`,
    });

    revalidateMatter(input.client_matter_id);
    return { ok: true, message: "PD claim started" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function updatePdClaimAction(input: {
  client_matter_id: string;
  pd_claim_id: string;
  vehicle_id: string;
  status?: string;
  repairable_or_total?: string | null;
  estimate_amount?: number | null;
  demand_blocker?: boolean;
  current_location?: string;
  storage_accruing?: boolean;
  notes?: string;
}): Promise<ActionResult> {
  try {
    await requireStaff();
    const supabase = createClient();
    const today = new Date().toISOString().slice(0, 10);
    const patch: Record<string, unknown> = { last_touch_date: today };
    if (input.status) patch.status = input.status;
    if (input.repairable_or_total !== undefined) {
      patch.repairable_or_total = input.repairable_or_total || null;
    }
    if (input.estimate_amount !== undefined) {
      patch.estimate_amount = input.estimate_amount;
    }
    if (input.demand_blocker !== undefined) {
      patch.demand_blocker = input.demand_blocker;
    }
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.status === "resolved") patch.resolved_date = today;

    const { error } = await supabase
      .schema("property")
      .from("pd_claim")
      .update(patch)
      .eq("pd_claim_id", input.pd_claim_id);
    if (error) return { ok: false, error: error.message };

    if (input.current_location !== undefined || input.storage_accruing !== undefined) {
      const vPatch: Record<string, unknown> = {};
      if (input.current_location !== undefined) {
        vPatch.current_location = input.current_location;
      }
      if (input.storage_accruing !== undefined) {
        vPatch.storage_accruing = input.storage_accruing;
      }
      await supabase
        .schema("property")
        .from("vehicle")
        .update(vPatch)
        .eq("vehicle_id", input.vehicle_id);
    }

    revalidateMatter(input.client_matter_id);
    return { ok: true, message: "PD updated — aging clock reset" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function createRecordRequestAction(input: {
  client_matter_id: string;
  treatment_episode_id: string;
  request_type: string;
  status?: string;
  sent_date?: string | null;
  follow_up_due?: string | null;
  hipaa_verified?: boolean;
  notes?: string;
}): Promise<ActionResult> {
  try {
    await requireStaff();
    const supabase = createClient();
    const { error } = await supabase.schema("medical").from("record_request").insert({
      treatment_episode_id: input.treatment_episode_id,
      request_type: input.request_type,
      status: input.status ?? "draft",
      sent_date: input.sent_date || null,
      follow_up_due: input.follow_up_due || null,
      hipaa_verified: Boolean(input.hipaa_verified),
      notes: input.notes?.trim() || null,
    });
    if (error) return { ok: false, error: error.message };
    revalidateMatter(input.client_matter_id);
    return { ok: true, message: "Records request created" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function updateRecordRequestAction(input: {
  client_matter_id: string;
  record_request_id: string;
  status: string;
  received_date?: string | null;
  follow_up_due?: string | null;
}): Promise<ActionResult> {
  try {
    await requireStaff();
    const supabase = createClient();
    const patch: Record<string, unknown> = { status: input.status };
    if (input.received_date !== undefined) patch.received_date = input.received_date;
    if (input.follow_up_due !== undefined) patch.follow_up_due = input.follow_up_due;
    const { error } = await supabase
      .schema("medical")
      .from("record_request")
      .update(patch)
      .eq("record_request_id", input.record_request_id);
    if (error) return { ok: false, error: error.message };
    revalidateMatter(input.client_matter_id);
    return { ok: true, message: "Records request updated" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function createDemandAction(input: {
  client_matter_id: string;
  demand_type?: string;
  amount?: number | null;
  notes?: string;
}): Promise<ActionResult> {
  try {
    const staff = await requireStaff();
    const supabase = createClient();
    const { error } = await supabase.schema("resolution").from("demand").insert({
      client_matter_id: input.client_matter_id,
      demand_type: input.demand_type ?? "standard",
      amount: input.amount ?? null,
      drafted_by: staff.staff_id,
      notes: input.notes?.trim() || null,
    });
    if (error) return { ok: false, error: error.message };
    revalidateMatter(input.client_matter_id);
    return { ok: true, message: "Demand draft created" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function markDemandReviewedAction(input: {
  client_matter_id: string;
  demand_id: string;
}): Promise<ActionResult> {
  try {
    const staff = await requireStaff();
    const supabase = createClient();
    const { error } = await supabase
      .schema("resolution")
      .from("demand")
      .update({
        reviewed_by: staff.staff_id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("demand_id", input.demand_id);
    if (error) return { ok: false, error: error.message };
    revalidateMatter(input.client_matter_id);
    return { ok: true, message: "Marked Kate-reviewed" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function logNegotiationAction(input: {
  client_matter_id: string;
  demand_id?: string | null;
  event_type: string;
  amount?: number | null;
  by_side: string;
  adjuster_or_counsel?: string;
  note?: string;
}): Promise<ActionResult> {
  try {
    const staff = await requireStaff();
    const supabase = createClient();
    const { error } = await supabase
      .schema("resolution")
      .from("negotiation_event")
      .insert({
        client_matter_id: input.client_matter_id,
        demand_id: input.demand_id || null,
        event_type: input.event_type,
        amount: input.amount ?? null,
        by_side: input.by_side,
        logged_by: staff.staff_id,
        adjuster_or_counsel: input.adjuster_or_counsel?.trim() || null,
        note: input.note?.trim() || null,
      });
    if (error) return { ok: false, error: error.message };
    revalidateMatter(input.client_matter_id);
    return { ok: true, message: "Negotiation event logged" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

function canAssignCaseManager(staff: {
  is_attorney: boolean;
  role_code: string;
}): boolean {
  return (
    staff.is_attorney ||
    staff.role_code === "admin" ||
    staff.role_code === "senior_paralegal" ||
    staff.role_code === "case_manager"
  );
}

/**
 * Assign (or clear) the active case_manager on a matter.
 * Ends any open CM assignment first (history preserved), then inserts the new one.
 */
export async function assignCaseManagerAction(
  matterId: string,
  newStaffId: string | null,
): Promise<ActionResult> {
  try {
    const staff = await requireStaff();
    if (!canAssignCaseManager(staff)) {
      return {
        ok: false,
        error: "You do not have permission to assign a case manager",
      };
    }
    if (!matterId) return { ok: false, error: "Matter required" };

    const supabase = createClient();

    if (newStaffId) {
      const { data: target, error: targetErr } = await supabase
        .schema("core")
        .from("staff")
        .select("staff_id, active, role_code")
        .eq("staff_id", newStaffId)
        .maybeSingle();
      if (targetErr) return { ok: false, error: targetErr.message };
      if (!target?.active) {
        return { ok: false, error: "Selected staff is not active" };
      }
    }

    const { data: current, error: curErr } = await supabase
      .schema("core")
      .from("staff_assignment")
      .select("staff_assignment_id, staff_id")
      .eq("client_matter_id", matterId)
      .eq("assignment_role", "case_manager")
      .is("ended_at", null)
      .is("deleted_at", null)
      .maybeSingle();
    if (curErr) return { ok: false, error: curErr.message };

    if (current && current.staff_id === newStaffId) {
      return { ok: true, message: "Case manager unchanged" };
    }

    if (current) {
      const { error: endErr } = await supabase
        .schema("core")
        .from("staff_assignment")
        .update({ ended_at: new Date().toISOString() })
        .eq("staff_assignment_id", current.staff_assignment_id);
      if (endErr) return { ok: false, error: endErr.message };
    }

    if (newStaffId) {
      const { error: insErr } = await supabase
        .schema("core")
        .from("staff_assignment")
        .insert({
          client_matter_id: matterId,
          staff_id: newStaffId,
          assignment_role: "case_manager",
          assigned_by: staff.staff_id,
        });
      if (insErr) return { ok: false, error: insErr.message };
    }

    revalidatePath(`/cases/${matterId}`);
    revalidatePath(`/litigation/${matterId}`);
    revalidatePath("/cases");
    revalidatePath("/owner");
    return {
      ok: true,
      message: newStaffId ? "Case manager assigned" : "Case manager cleared",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
