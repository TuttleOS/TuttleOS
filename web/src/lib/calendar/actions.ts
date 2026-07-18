"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStaff } from "@/lib/staff-server";
import {
  listCalendarConnections,
  listRecentSyncFailures,
  syncDeadlineHorizonBatch,
} from "./syncDeadline";
import type { CalendarMode, CalendarProvider } from "./types";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

async function requireAttorney() {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("Not signed in");
  if (!staff.is_attorney && staff.role_code !== "admin") {
    throw new Error("Calendar settings are attorney/admin only");
  }
  return staff;
}

export async function loadCalendarSettingsAction() {
  await requireAttorney();
  const [connections, failures] = await Promise.all([
    listCalendarConnections(),
    listRecentSyncFailures(),
  ]);
  return { connections, failures };
}

export async function saveCalendarConnectionAction(input: {
  calendar_connection_id: string;
  enabled: boolean;
  mode: CalendarMode;
  dpa_on_file: boolean;
  calendar_id?: string | null;
  notes?: string | null;
}): Promise<ActionResult> {
  try {
    await requireAttorney();
    if (input.mode === "live" && !input.dpa_on_file) {
      return {
        ok: false,
        error: "Cannot enable live mode without DPA on file (gate 9.1)",
      };
    }
    const supabase = createClient();
    const { error } = await supabase
      .schema("workflow")
      .from("calendar_connection")
      .update({
        enabled: input.enabled,
        mode: input.mode,
        dpa_on_file: input.dpa_on_file,
        calendar_id: input.calendar_id ?? null,
        notes: input.notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("calendar_connection_id", input.calendar_connection_id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/owner/calendar");
    return { ok: true, message: "Connection saved" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

export async function ensureProviderConnectionAction(
  provider: CalendarProvider,
): Promise<ActionResult> {
  try {
    await requireAttorney();
    const supabase = createClient();
    const { error } = await supabase
      .schema("workflow")
      .from("calendar_connection")
      .upsert(
        {
          provider,
          enabled: provider === "dry_run",
          mode: "dry_run",
          dpa_on_file: false,
          notes:
            provider === "dry_run"
              ? "Dry-run logger"
              : `${provider} stub — live after DPA + OAuth`,
        },
        { onConflict: "provider" },
      );
    if (error) return { ok: false, error: error.message };
    revalidatePath("/owner/calendar");
    return { ok: true, message: `${provider} connection ready` };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

export async function runHorizonDrySyncAction(): Promise<ActionResult> {
  try {
    await requireAttorney();
    const out = await syncDeadlineHorizonBatch(40);
    revalidatePath("/owner/calendar");
    return {
      ok: true,
      message: `Synced ${out.attempted} horizon deadlines (${out.failed} failures)`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}
