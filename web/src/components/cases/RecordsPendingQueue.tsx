"use client";

import Link from "next/link";
import { formatDate } from "@/lib/dates";
import type { RecordsPendingQueueRow } from "@/lib/cases/types";

export function RecordsPendingQueue({
  rows,
}: {
  rows: RecordsPendingQueueRow[];
}) {
  const overdueFollowUp = rows.filter(
    (r) =>
      r.follow_up_due &&
      r.follow_up_due < new Date().toISOString().slice(0, 10),
  ).length;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-accent-dk">
          Case Manager workspace
        </p>
        <h1 className="text-2xl font-bold">Records pending</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Outstanding medical records / bills requests (not received or
          cancelled). Mark received on the Records card; the row leaves this
          queue.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-panel border border-grid bg-surface px-4 py-3 shadow-soft">
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted">
            Outstanding requests
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{rows.length}</div>
        </div>
        <div className="rounded-panel border border-grid bg-surface px-4 py-3 shadow-soft">
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted">
            Follow-up overdue
          </div>
          <div
            className={`mt-1 text-2xl font-bold tabular-nums ${
              overdueFollowUp > 0 ? "text-danger" : ""
            }`}
          >
            {overdueFollowUp}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-panel border border-grid bg-surface px-4 py-10 text-sm text-muted shadow-soft">
          No outstanding records requests. Draft / sent / partial / problem
          requests appear here until received.
        </p>
      ) : (
        <section className="overflow-hidden rounded-panel border border-grid bg-surface shadow-soft">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-grid text-xs text-muted">
                <th className="px-4 py-2.5 font-semibold">Client</th>
                <th className="px-4 py-2.5 font-semibold">DOI</th>
                <th className="px-4 py-2.5 font-semibold">Provider / type</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Days</th>
                <th className="px-4 py-2.5 font-semibold">Follow-up</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const followOver =
                  r.follow_up_due &&
                  r.follow_up_due < new Date().toISOString().slice(0, 10);
                return (
                  <tr
                    key={r.record_request_id}
                    className={`border-b border-grid hover:bg-surface-2/60 ${
                      followOver ? "bg-danger-bg/20" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/cases/${r.client_matter_id}?focus=records`}
                        className="font-semibold text-accent-dk no-underline hover:underline"
                        data-testid="records-pending-row"
                      >
                        {r.display_name}
                      </Link>
                      {r.matter_number && (
                        <div className="text-xs text-muted">
                          {r.matter_number}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatDate(r.date_of_loss)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {r.provider_name ?? "Provider"}
                      </div>
                      <div className="text-xs text-muted">{r.request_type}</div>
                    </td>
                    <td className="px-4 py-3">{r.status}</td>
                    <td className="px-4 py-3 tabular-nums">{r.days_pending}d</td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatDate(r.follow_up_due)}
                      {followOver && (
                        <div className="text-[10px] font-bold uppercase text-danger">
                          Overdue
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
