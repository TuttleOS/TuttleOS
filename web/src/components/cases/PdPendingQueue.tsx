"use client";

import Link from "next/link";
import { formatDate } from "@/lib/dates";
import type { PdPendingQueueRow } from "@/lib/cases/types";

export function PdPendingQueue({ rows }: { rows: PdPendingQueueRow[] }) {
  const blockers = rows.filter((r) => r.demand_blocker).length;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-accent-dk">
          Case Manager workspace
        </p>
        <h1 className="text-2xl font-bold">PD pending</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Unresolved property-damage claims (
          <code className="text-xs">property.v_pd_aging</code>). Mark resolved on
          the PD card; the row leaves this queue.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-panel border border-grid bg-surface px-4 py-3 shadow-soft">
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted">
            Unresolved PD
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{rows.length}</div>
        </div>
        <div className="rounded-panel border border-grid bg-surface px-4 py-3 shadow-soft">
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted">
            Demand blockers
          </div>
          <div
            className={`mt-1 text-2xl font-bold tabular-nums ${
              blockers > 0 ? "text-danger" : ""
            }`}
          >
            {blockers}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-panel border border-grid bg-surface px-4 py-10 text-sm text-muted shadow-soft">
          No open PD claims. Resolved and N/A PD tracks stay off this queue.
        </p>
      ) : (
        <section className="overflow-hidden rounded-panel border border-grid bg-surface shadow-soft">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-grid text-xs text-muted">
                <th className="px-4 py-2.5 font-semibold">Client</th>
                <th className="px-4 py-2.5 font-semibold">DOI</th>
                <th className="px-4 py-2.5 font-semibold">Vehicle</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Days since touch</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.pd_claim_id}
                  className={`border-b border-grid hover:bg-surface-2/60 ${
                    r.demand_blocker ? "bg-danger-bg/20" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/cases/${r.client_matter_id}?focus=pd`}
                      className="font-semibold text-accent-dk no-underline hover:underline"
                      data-testid="pd-pending-row"
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
                  <td className="px-4 py-3">{r.vehicle_label}</td>
                  <td className="px-4 py-3">
                    {r.status}
                    {r.demand_blocker && (
                      <div className="text-[10px] font-bold uppercase text-danger">
                        Demand blocker
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {r.days_since_touch != null ? `${r.days_since_touch}d` : "—"}
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
