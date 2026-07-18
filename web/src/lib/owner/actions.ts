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

function revalidateOwner(matterId?: string) {
  revalidatePath("/owner");
  revalidatePath("/owner/approvals");
  revalidatePath("/owner/sol");
  if (matterId) {
    revalidatePath(`/cases/${matterId}`);
    revalidatePath(`/litigation/${matterId}`);
  }
}

export async function approveLevelAction(
  matterId: string,
  level: number,
): Promise<ActionResult> {
  try {
    const staff = await requireStaff();
    if (!staff.can_approve_level) {
      return { ok: false, error: "You are not authorized to approve Level" };
    }
    if (level < 0 || level > 3) {
      return { ok: false, error: "Level must be 0–3" };
    }

    const supabase = createClient();
    const { error } = await supabase
      .schema("core")
      .from("client_matter")
      .update({ approved_level: level })
      .eq("client_matter_id", matterId);
    if (error) return { ok: false, error: error.message };

    revalidateOwner(matterId);
    return { ok: true, message: `Level ${level} approved` };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

export async function approveDemandAction(
  demandId: string,
  matterId: string,
): Promise<ActionResult> {
  try {
    const staff = await requireStaff();
    if (!staff.is_attorney && !staff.can_approve_level) {
      return { ok: false, error: "Attorney approval required for L3 demand" };
    }

    const supabase = createClient();
    const { error } = await supabase
      .schema("resolution")
      .from("demand")
      .update({
        attorney_approved_by: staff.staff_id,
        attorney_approved_at: new Date().toISOString(),
      })
      .eq("demand_id", demandId);
    if (error) return { ok: false, error: error.message };

    revalidateOwner(matterId);
    return { ok: true, message: "L3 demand approved" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}
