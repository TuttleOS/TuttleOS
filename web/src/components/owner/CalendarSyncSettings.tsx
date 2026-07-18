"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatDate } from "@/lib/dates";
import {
  ensureProviderConnectionAction,
  runHorizonDrySyncAction,
  saveCalendarConnectionAction,
} from "@/lib/calendar/actions";
import type {
  CalendarConnectionRow,
  CalendarMode,
  DeadlineSyncRow,
} from "@/lib/calendar/types";

export function CalendarSyncSettings({
  connections,
  failures,
  featureFlagOn,
}: {
  connections: CalendarConnectionRow[];
  failures: DeadlineSyncRow[];
  featureFlagOn: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function run(
    fn: () => Promise<{ ok: boolean; error?: string; message?: string }>,
  ) {
    setMsg(null);
    setErr(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setErr(res.error ?? "Failed");
      else setMsg(res.message ?? "Done");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-accent-dk">
          Phase 9 · Calendar sync
        </p>
        <h1 className="text-2xl font-bold">Firm calendar</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Every <code className="text-xs">workflow.deadline</code> add / move /
          vacatur pushes to Microsoft Graph and/or Google Calendar. Titles are
          PHI-minimized (label + matter number — no medical narrative). Live
          mode requires vendor DPA (gate 9.1).
        </p>
        <p className="mt-2 text-xs text-muted">
          Feature flag{" "}
          <code className="text-xs">NEXT_PUBLIC_FEATURE_CALENDAR_SYNC</code>:{" "}
          {featureFlagOn ? (
            <span className="font-semibold text-success">on</span>
          ) : (
            <span className="font-semibold text-warning">off</span>
          )}{" "}
          (dry-run still works for testing).
        </p>
      </div>

      {msg && <p className="text-sm font-semibold text-success">{msg}</p>}
      {err && <p className="text-sm font-semibold text-danger">{err}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => runHorizonDrySyncAction())}
          className="rounded-lg bg-accent-dk px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          Sync Deadline Horizon (dry-run / enabled adapters)
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() => ensureProviderConnectionAction("microsoft_graph"))
          }
          className="rounded-lg border border-grid px-3 py-2 text-sm font-semibold hover:bg-surface-2 disabled:opacity-50"
        >
          Ensure Graph connection
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() => ensureProviderConnectionAction("google_calendar"))
          }
          className="rounded-lg border border-grid px-3 py-2 text-sm font-semibold hover:bg-surface-2 disabled:opacity-50"
        >
          Ensure Google connection
        </button>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
          Connections
        </h2>
        {connections.length === 0 ? (
          <p className="text-sm text-muted">
            No connections — apply{" "}
            <code className="text-xs">sql/08_upgrade_v2.7_calendar_sync.sql</code>{" "}
            or click Ensure Graph/Google.
          </p>
        ) : (
          connections.map((c) => (
            <ConnectionCard
              key={c.calendar_connection_id}
              row={c}
              pending={pending}
              onSave={(patch) =>
                run(() =>
                  saveCalendarConnectionAction({
                    calendar_connection_id: c.calendar_connection_id,
                    ...patch,
                  }),
                )
              }
            />
          ))
        )}
      </section>

      <section className="rounded-panel border border-grid bg-surface shadow-soft">
        <div className="border-b border-grid px-5 py-3 text-sm font-bold">
          Sync failures / pending (visible — gate 9.3)
        </div>
        {failures.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">No failed or pending syncs.</p>
        ) : (
          <ul className="divide-y divide-grid text-sm">
            {failures.map((f) => (
              <li key={f.deadline_calendar_sync_id} className="px-5 py-3">
                <div className="font-semibold">
                  {f.deadline_label ?? f.deadline_id}
                </div>
                <div className="text-xs text-muted">
                  {f.sync_status}
                  {f.last_synced_at
                    ? ` · ${formatDate(f.last_synced_at)}`
                    : ""}
                </div>
                {f.last_error && (
                  <div className="mt-1 text-xs text-danger">{f.last_error}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ConnectionCard({
  row,
  pending,
  onSave,
}: {
  row: CalendarConnectionRow;
  pending: boolean;
  onSave: (patch: {
    enabled: boolean;
    mode: CalendarMode;
    dpa_on_file: boolean;
    calendar_id: string | null;
    notes: string | null;
  }) => void;
}) {
  const [enabled, setEnabled] = useState(row.enabled);
  const [mode, setMode] = useState<CalendarMode>(row.mode);
  const [dpa, setDpa] = useState(row.dpa_on_file);
  const [calendarId, setCalendarId] = useState(row.calendar_id ?? "");
  const [notes, setNotes] = useState(row.notes ?? "");

  return (
    <div className="rounded-panel border border-grid bg-surface p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">{row.provider}</h3>
        <span className="text-xs text-muted">{row.calendar_connection_id}</span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Enabled
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={dpa}
            onChange={(e) => setDpa(e.target.checked)}
          />
          DPA on file (gate 9.1)
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Mode</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as CalendarMode)}
            className="h-10 w-full rounded-lg border border-grid bg-page px-3"
          >
            <option value="dry_run">dry_run</option>
            <option value="live">live</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">External calendar id</span>
          <input
            value={calendarId}
            onChange={(e) => setCalendarId(e.target.value)}
            className="h-10 w-full rounded-lg border border-grid bg-page px-3"
            placeholder="optional until live"
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-muted">Notes</span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="h-10 w-full rounded-lg border border-grid bg-page px-3"
          />
        </label>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          onSave({
            enabled,
            mode,
            dpa_on_file: dpa,
            calendar_id: calendarId || null,
            notes: notes || null,
          })
        }
        className="mt-4 rounded-lg border border-grid px-3 py-2 text-sm font-semibold hover:bg-surface-2 disabled:opacity-50"
      >
        Save
      </button>
    </div>
  );
}
