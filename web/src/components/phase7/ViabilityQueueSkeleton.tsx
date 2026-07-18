import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { STAGE_LABEL } from "@/lib/cases/types";
import type { ViabilityQueueRow } from "@/lib/phase7/queries";

export function ViabilityQueueSkeleton({
  rows,
}: {
  rows: ViabilityQueueRow[];
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-accent-dk">
          Phase 7 · skeleton
        </p>
        <h1 className="text-2xl font-bold">Senior review — 7-day viability</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Open rows from{" "}
          <code className="text-xs">workflow.viability_review</code>{" "}
          (<code className="text-xs">reviewed_at IS NULL</code>). Accept / reject
          actions deferred until owner screen proposals are approved.
        </p>
      </div>

      <section className="overflow-hidden rounded-panel border border-grid bg-surface shadow-soft">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-grid text-xs text-muted">
              <th className="px-4 py-2.5 font-semibold">Client</th>
              <th className="px-4 py-2.5 font-semibold">Due</th>
              <th className="px-4 py-2.5 font-semibold">Prep</th>
              <th className="px-4 py-2.5 font-semibold">CM recommendation</th>
              <th className="px-4 py-2.5 font-semibold">Stage</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-muted">
                  No open viability reviews. Reviews are created when a matter
                  enters the viability stage (contract executed).
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const overdue = r.due_date < today;
                return (
                  <tr
                    key={r.viability_review_id}
                    className={`border-b border-grid ${
                      overdue ? "bg-danger-bg/40" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/cases/${r.client_matter_id}`}
                        className="font-semibold text-accent-dk no-underline hover:underline"
                      >
                        {r.display_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={
                          overdue ? "font-bold text-danger" : "font-semibold"
                        }
                      >
                        {formatDate(r.due_date)}
                      </span>
                      {overdue && (
                        <div className="text-[10px] font-bold uppercase text-danger">
                          Overdue
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">{r.prep_status}</td>
                    <td className="px-4 py-3 text-xs">
                      {r.cm_recommendation ?? "—"}
                      {r.cm_recommended_level != null
                        ? ` · L${r.cm_recommended_level}`
                        : ""}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {STAGE_LABEL[r.current_stage_code] ??
                        r.current_stage_code}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
