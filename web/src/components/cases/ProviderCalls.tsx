"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatDate } from "@/lib/dates";
import { logProviderCallAction } from "@/lib/cases/actions";
import type { ProviderCallDue } from "@/lib/cases/types";

export function ProviderCalls({ rows }: { rows: ProviderCallDue[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(
    rows[0]?.task_id ?? null,
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const active = rows.find((r) => r.task_id === activeId) ?? rows[0] ?? null;

  const overdue = rows.filter(
    (r) => r.due_date && r.due_date < new Date().toISOString().slice(0, 10),
  ).length;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-accent-dk">
          Case Manager workspace
        </p>
        <h1 className="text-2xl font-bold">Provider Calls</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Bi-weekly treatment / balance checks from{" "}
          <code className="text-xs">medical.v_provider_calls_due</code>. Logging
          a call writes{" "}
          <code className="text-xs">medical.provider_contact_log</code> and the
          database schedules the next task in 14 days.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Due / open" value={String(rows.length)} />
        <Stat label="Overdue" value={String(overdue)} hot={overdue > 0} />
        <Stat
          label="Primary PM episodes"
          value={String(new Set(rows.map((r) => r.treatment_episode_id)).size)}
        />
      </div>

      {msg && <p className="text-sm font-semibold text-success">{msg}</p>}
      {err && <p className="text-sm font-semibold text-danger">{err}</p>}

      {rows.length === 0 ? (
        <p className="rounded-panel border border-grid bg-surface px-4 py-10 text-sm text-muted shadow-soft">
          No provider-call tasks due. Active primary pain-management episodes
          with an open <code className="text-xs">provider_call</code> task
          appear here. Seed treatment + a call task, or wait for the next
          scheduled check.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <section className="overflow-hidden rounded-panel border border-grid bg-surface shadow-soft">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-grid text-xs text-muted">
                  <th className="px-4 py-2.5 font-semibold">Client</th>
                  <th className="px-4 py-2.5 font-semibold">Provider</th>
                  <th className="px-4 py-2.5 font-semibold">Due</th>
                  <th className="px-4 py-2.5 font-semibold">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isOver =
                    r.due_date &&
                    r.due_date < new Date().toISOString().slice(0, 10);
                  const selected = r.task_id === active?.task_id;
                  return (
                    <tr
                      key={r.task_id}
                      className={`cursor-pointer border-b border-grid ${
                        selected ? "bg-accent/10" : "hover:bg-surface-2/60"
                      } ${isOver ? "bg-danger-bg/30" : ""}`}
                      onClick={() => setActiveId(r.task_id)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold">{r.display_name}</div>
                        <Link
                          href={`/cases/${r.client_matter_id}`}
                          className="text-xs text-accent-dk hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Open matter →
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {r.provider_name}
                        <div className="text-xs text-muted">
                          {r.episode_status}
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatDate(r.due_date)}
                        {isOver && (
                          <div className="text-[10px] font-bold uppercase text-danger">
                            Overdue
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {r.approx_balance != null
                          ? `$${r.approx_balance.toLocaleString()}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {active && (
            <LogCallForm
              row={active}
              pending={pending}
              onSubmit={(payload) => {
                setMsg(null);
                setErr(null);
                start(async () => {
                  const res = await logProviderCallAction(payload);
                  if (!res.ok) setErr(res.error);
                  else {
                    setMsg(res.message ?? "Logged");
                    setActiveId(null);
                  }
                  router.refresh();
                });
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function LogCallForm({
  row,
  pending,
  onSubmit,
}: {
  row: ProviderCallDue;
  pending: boolean;
  onSubmit: (payload: {
    treatment_episode_id: string;
    client_matter_id: string;
    task_id: string;
    reached: boolean;
    treatment_confirmed: boolean;
    approx_balance: number | null;
    next_appointment_date: string | null;
    gap_or_compliance_concern: boolean;
    note: string;
  }) => void;
}) {
  const [reached, setReached] = useState(true);
  const [confirmed, setConfirmed] = useState(true);
  const [gap, setGap] = useState(false);
  const [balance, setBalance] = useState(
    row.approx_balance != null ? String(row.approx_balance) : "",
  );
  const [nextAppt, setNextAppt] = useState("");
  const [note, setNote] = useState("");

  return (
    <section className="rounded-panel border border-grid bg-surface p-4 shadow-soft">
      <h2 className="text-sm font-bold">Log provider call</h2>
      <p className="mt-1 text-sm text-muted">
        {row.display_name} · {row.provider_name}
      </p>

      <div className="mt-4 space-y-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={reached}
            onChange={(e) => setReached(e.target.checked)}
          />
          Reached provider
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          Treatment confirmed / still treating
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={gap}
            onChange={(e) => setGap(e.target.checked)}
          />
          Gap / compliance concern
        </label>

        <div>
          <label className="text-xs font-semibold text-muted">
            Approx balance ($)
          </label>
          <input
            type="number"
            step="0.01"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-grid bg-page px-3"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted">
            Next appointment
          </label>
          <input
            type="date"
            value={nextAppt}
            onChange={(e) => setNextAppt(e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-grid bg-page px-3"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted">Note</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-grid bg-page px-3 py-2"
            placeholder="What they said…"
          />
        </div>

        <button
          type="button"
          disabled={pending}
          onClick={() =>
            onSubmit({
              treatment_episode_id: row.treatment_episode_id,
              client_matter_id: row.client_matter_id,
              task_id: row.task_id,
              reached,
              treatment_confirmed: confirmed,
              approx_balance: balance.trim() ? Number(balance) : null,
              next_appointment_date: nextAppt || null,
              gap_or_compliance_concern: gap,
              note,
            })
          }
          className="w-full rounded-lg bg-accent-dk px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save call log"}
        </button>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  hot,
}: {
  label: string;
  value: string;
  hot?: boolean;
}) {
  return (
    <div className="rounded-panel border border-grid bg-surface px-4 py-3 shadow-soft">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums ${
          hot ? "text-danger" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
