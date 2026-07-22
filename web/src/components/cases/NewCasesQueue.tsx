"use client";

import Link from "next/link";
import { formatDate } from "@/lib/dates";
import type { NewCaseQueueRow } from "@/lib/cases/types";

export function NewCasesQueue({ rows }: { rows: NewCaseQueueRow[] }) {
  const aging = rows.filter((r) => r.days_since_assignment > 2).length;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-accent-dk">
          Case Manager workspace
        </p>
        <h1 className="text-2xl font-bold">New cases</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Cases assigned to you whose sign-up processing has not started — checklist
          untouched (or welcome call not done). Process immediately; rows leave this
          queue when checklist work begins.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Stat label="In queue" value={String(rows.length)} />
        <Stat
          label="Aging over 2 days"
          value={String(aging)}
          hot={aging > 0}
        />
      </div>

      {rows.length === 0 ? (
        <p className="rounded-panel border border-grid bg-surface px-4 py-10 text-sm text-muted shadow-soft">
          No new cases waiting. When a matter is assigned and sign-up has not started,
          it appears here.
        </p>
      ) : (
        <section className="overflow-hidden rounded-panel border border-grid bg-surface shadow-soft">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-grid text-xs text-muted">
                <th className="px-4 py-2.5 font-semibold">Client</th>
                <th className="px-4 py-2.5 font-semibold">DOI</th>
                <th className="px-4 py-2.5 font-semibold">Assigned</th>
                <th className="px-4 py-2.5 font-semibold">Days</th>
                <th className="px-4 py-2.5 font-semibold">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const hot = r.days_since_assignment > 2;
                return (
                  <tr
                    key={r.client_matter_id}
                    className={`border-b border-grid hover:bg-surface-2/60 ${
                      hot ? "bg-danger-bg/25" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/cases/${r.client_matter_id}?focus=checklist`}
                        className="font-semibold text-accent-dk no-underline hover:underline"
                        data-testid="new-case-row"
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
                    <td className="px-4 py-3 tabular-nums">
                      {formatDate(r.assigned_at)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      <span
                        className={
                          hot ? "font-bold text-danger" : undefined
                        }
                      >
                        {r.days_since_assignment}d
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {r.outstanding.slice(0, 3).join(" · ")}
                      {r.outstanding.length > 3
                        ? ` · +${r.outstanding.length - 3} more`
                        : ""}
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
      <div className="text-[11px] font-bold uppercase tracking-wide text-muted">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-bold tabular-nums ${
          hot ? "text-danger" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
