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
