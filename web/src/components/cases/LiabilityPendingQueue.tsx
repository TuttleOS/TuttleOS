"use client";

import Link from "next/link";
import { formatDate } from "@/lib/dates";
import type { LiabilityPendingQueueRow } from "@/lib/cases/types";

export function LiabilityPendingQueue({
  rows,
}: {
  rows: LiabilityPendingQueueRow[];
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-accent-dk">
          Case Manager workspace
        </p>
        <h1 className="text-2xl font-bold">Liability pending</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Liability claims still at status <code className="text-xs">open</code>{" "}
          — no carrier decision yet. Update the claim status on Insurance &amp;
          claims; the row leaves this queue when liability is accepted, disputed,
          or denied.
        </p>
      </div>

      <div className="rounded-panel border border-grid bg-surface px-4 py-3 shadow-soft">
        <div className="text-[11px] font-bold uppercase tracking-wide text-muted">
          Pending decisions
        </div>
        <div className="mt-1 text-2xl font-bold tabular-nums">{rows.length}</div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-panel border border-grid bg-surface px-4 py-10 text-sm text-muted shadow-soft">
          No open liability decisions. DINSCO / PINSCO / umbrella claims with
          status open appear here.
        </p>
      ) : (
        <section className="overflow-hidden rounded-panel border border-grid bg-surface shadow-soft">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-grid text-xs text-muted">
                <th className="px-4 py-2.5 font-semibold">Client</th>
                <th className="px-4 py-2.5 font-semibold">DOI</th>
                <th className="px-4 py-2.5 font-semibold">Claim</th>
                <th className="px-4 py-2.5 font-semibold">Days pending</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.claim_id}
                  className="border-b border-grid hover:bg-surface-2/60"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/cases/${r.client_matter_id}?focus=insurance`}
                      className="font-semibold text-accent-dk no-underline hover:underline"
                      data-testid="liability-pending-row"
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
                    <div className="font-medium">{r.claim_role}</div>
                    <div className="text-xs text-muted">
                      {r.claim_number ? `#${r.claim_number}` : "No claim #"} ·{" "}
                      {r.claim_status}
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{r.days_pending}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
