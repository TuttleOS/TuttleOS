"use client";

import Link from "next/link";
import { formatDate } from "@/lib/dates";
import type { LorPendingQueueRow } from "@/lib/cases/types";

export function LorPendingQueue({ rows }: { rows: LorPendingQueueRow[] }) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-accent-dk">
          Case Manager workspace
        </p>
        <h1 className="text-2xl font-bold">LORs pending</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Incomplete Send-LOR checklist tasks. Proof of completion is{" "}
          <code className="text-xs">insurance.claim.lor_sent_date</code> — a
          generated letter alone never counts. Enter the sent date on the claim
          card; the row disappears on refresh.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-1">
        <div className="rounded-panel border border-grid bg-surface px-4 py-3 shadow-soft">
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted">
            Pending LORs
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{rows.length}</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-panel border border-grid bg-surface px-4 py-10 text-sm text-muted shadow-soft">
          No LOR tasks pending. When a Send DINSCO/PINSCO LOR checklist item is
          open, it appears here until the LOR sent date is entered on the claim.
        </p>
      ) : (
        <section className="overflow-hidden rounded-panel border border-grid bg-surface shadow-soft">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-grid text-xs text-muted">
                <th className="px-4 py-2.5 font-semibold">Client</th>
                <th className="px-4 py-2.5 font-semibold">DOI</th>
                <th className="px-4 py-2.5 font-semibold">Task / claim</th>
                <th className="px-4 py-2.5 font-semibold">Days pending</th>
                <th className="px-4 py-2.5 font-semibold">Due</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.task_id}
                  className="border-b border-grid hover:bg-surface-2/60"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/cases/${r.client_matter_id}?focus=insurance`}
                      className="font-semibold text-accent-dk no-underline hover:underline"
                      data-testid="lor-pending-row"
                    >
                      {r.display_name}
                    </Link>
                    {r.matter_number && (
                      <div className="text-xs text-muted">{r.matter_number}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatDate(r.date_of_loss)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.task_title}</div>
                    <div className="text-xs text-muted">
                      {r.claim_role
                        ? `${r.claim_role}${
                            r.claim_number ? ` · #${r.claim_number}` : ""
                          }`
                        : "No matching claim yet — open claim first"}
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{r.days_pending}d</td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatDate(r.due_date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
