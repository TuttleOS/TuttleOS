import { createClient } from "@/lib/supabase/server";
import type { CalendarAdapter } from "./adapter";
import { DryRunCalendarAdapter } from "./dryRunAdapter";
import { GraphCalendarAdapter } from "./graphAdapter";
import { GoogleCalendarAdapter } from "./googleAdapter";
import { buildDeadlineCalendarEvent, payloadHash } from "./phiTitle";
import type {
  CalendarConnectionRow,
  CalendarProvider,
  DeadlineSyncRow,
} from "./types";

export function calendarFeatureEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FEATURE_CALENDAR_SYNC === "true";
}

export function adapterFor(
  provider: CalendarProvider,
  mode: "dry_run" | "live",
): CalendarAdapter {
  if (mode === "dry_run" || provider === "dry_run") {
    return new DryRunCalendarAdapter();
  }
  if (provider === "microsoft_graph") return new GraphCalendarAdapter();
  if (provider === "google_calendar") return new GoogleCalendarAdapter();
  return new DryRunCalendarAdapter();
}

export async function listCalendarConnections(): Promise<
  CalendarConnectionRow[]
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("workflow")
    .from("calendar_connection")
    .select(
      "calendar_connection_id, provider, enabled, mode, calendar_id, dpa_on_file, notes",
    )
    .is("deleted_at", null)
    .order("provider");
  if (error) throw new Error(error.message);
  return (data ?? []) as CalendarConnectionRow[];
}

export async function listRecentSyncFailures(
  limit = 25,
): Promise<DeadlineSyncRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("workflow")
    .from("deadline_calendar_sync")
    .select(
      "deadline_calendar_sync_id, deadline_id, calendar_connection_id, external_event_id, last_synced_at, last_error, sync_status",
    )
    .in("sync_status", ["failed", "pending"])
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as DeadlineSyncRow[];
  if (!rows.length) return [];

  const ids = rows.map((r) => r.deadline_id);
  const { data: deadlines } = await supabase
    .schema("workflow")
    .from("deadline")
    .select("deadline_id, label")
    .in("deadline_id", ids);
  const labels = new Map(
    (deadlines ?? []).map((d) => [d.deadline_id, d.label] as const),
  );
  for (const r of rows) r.deadline_label = labels.get(r.deadline_id) ?? null;
  return rows;
}

/**
 * Push one deadline to all enabled calendar connections.
 * Call after deadline insert/update/vacatur (and from owner dry-run batch).
 */
export async function syncDeadlineToCalendars(
  deadlineId: string,
): Promise<{ results: { provider: string; ok: boolean; error?: string }[] }> {
  const supabase = createClient();

  const { data: deadline, error: dErr } = await supabase
    .schema("workflow")
    .from("deadline")
    .select(
      "deadline_id, label, effective_date, jurisdictional, status, source, rule_code, client_matter_id",
    )
    .eq("deadline_id", deadlineId)
    .maybeSingle();
  if (dErr) throw new Error(dErr.message);
  if (!deadline) throw new Error("Deadline not found");

  let matterNumber: string | null = null;
  if (deadline.client_matter_id) {
    const { data: m } = await supabase
      .schema("core")
      .from("client_matter")
      .select("matter_number")
      .eq("client_matter_id", deadline.client_matter_id)
      .maybeSingle();
    matterNumber = m?.matter_number ?? null;
  }

  const event = buildDeadlineCalendarEvent({
    deadlineId: deadline.deadline_id,
    label: deadline.label,
    effectiveDate: deadline.effective_date,
    jurisdictional: !!deadline.jurisdictional,
    status: deadline.status,
    source: deadline.source,
    ruleCode: deadline.rule_code,
    matterId: deadline.client_matter_id,
    matterNumber,
  });

  const connections = (await listCalendarConnections()).filter((c) => c.enabled);
  if (!connections.length) {
    return {
      results: [
        {
          provider: "none",
          ok: false,
          error: "No enabled calendar_connection rows",
        },
      ],
    };
  }

  const results: { provider: string; ok: boolean; error?: string }[] = [];
  const hash = payloadHash(event);
  const shouldCancel =
    deadline.status === "vacated" || deadline.status === "n_a";

  for (const conn of connections) {
    const adapter = adapterFor(conn.provider, conn.mode);
    let result;

    if (shouldCancel) {
      const { data: existing } = await supabase
        .schema("workflow")
        .from("deadline_calendar_sync")
        .select("external_event_id")
        .eq("deadline_id", deadlineId)
        .eq("calendar_connection_id", conn.calendar_connection_id)
        .maybeSingle();
      if (existing?.external_event_id) {
        result = await adapter.cancel(
          existing.external_event_id,
          deadlineId,
        );
      } else {
        result = {
          ok: true,
          provider: conn.provider,
          externalEventId: null,
          dryRun: conn.mode === "dry_run",
        };
      }
    } else {
      if (conn.mode === "live" && !conn.dpa_on_file) {
        result = {
          ok: false,
          provider: conn.provider,
          externalEventId: null,
          dryRun: false,
          error: "Live mode blocked — dpa_on_file is false (gate 9.1)",
        };
      } else {
        result = await adapter.upsert(event);
      }
    }

    const syncStatus = !result.ok
      ? "failed"
      : shouldCancel
        ? "cancelled"
        : "synced";

    const { error: upErr } = await supabase
      .schema("workflow")
      .from("deadline_calendar_sync")
      .upsert(
        {
          deadline_id: deadlineId,
          calendar_connection_id: conn.calendar_connection_id,
          external_event_id: result.externalEventId,
          last_payload_hash: hash,
          last_synced_at: new Date().toISOString(),
          last_error: result.ok ? null : (result.error ?? "unknown"),
          sync_status: syncStatus,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "deadline_id,calendar_connection_id" },
      );
    if (upErr) {
      results.push({
        provider: conn.provider,
        ok: false,
        error: upErr.message,
      });
    } else {
      results.push({
        provider: conn.provider,
        ok: result.ok,
        error: result.error,
      });
    }
  }

  return { results };
}

/** Dry-run / push all pending horizon deadlines (owner batch). */
export async function syncDeadlineHorizonBatch(limit = 40): Promise<{
  attempted: number;
  failed: number;
  errors: string[];
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("litigation")
    .from("v_deadline_horizon")
    .select("deadline_id")
    .limit(limit);
  if (error) throw new Error(error.message);

  let failed = 0;
  const errors: string[] = [];
  for (const row of data ?? []) {
    const { results } = await syncDeadlineToCalendars(row.deadline_id);
    for (const r of results) {
      if (!r.ok) {
        failed += 1;
        errors.push(`${row.deadline_id} ${r.provider}: ${r.error ?? "fail"}`);
      }
    }
  }
  return { attempted: (data ?? []).length, failed, errors: errors.slice(0, 10) };
}
