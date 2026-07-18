import Link from "next/link";
import { formatDate } from "@/lib/dates";
import type { HorizonRow } from "@/lib/litigation/types";

export function DeadlineHorizon({ rows }: { rows: HorizonRow[] }) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="rounded-panel border border-grid bg-surface shadow-soft">
      <div className="border-b border-grid px-5 py-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-accent-dk">
          Litigation Paralegal workspace
        </p>
        <h1 className="text-xl font-bold">Deadline Horizon</h1>
        <p className="text-sm text-muted">
          Next 45 days. Overdue stays pinned in red — never ages off silently.
        </p>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-grid text-xs text-muted">
            <th className="px-5 py-2 font-semibold">Date</th>
            <th className="px-5 py-2 font-semibold">Deadline</th>
            <th className="px-5 py-2 font-semibold">Case</th>
            <th className="px-5 py-2 font-semibold">Source</th>
            <th className="px-5 py-2 font-semibold">Citation</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-5 py-10 text-muted">
                No pending deadlines in the next 45 days.
              </td>
            </tr>
          ) : (
            rows.map((r) => {
              const overdue = r.effective_date < today;
              return (
                <tr
                  key={r.deadline_id}
                  className={`border-b border-grid ${
                    overdue ? "bg-danger-bg/50" : ""
                  }`}
                >
                  <td className="px-5 py-3 whitespace-nowrap">
                    <span
                      className={
                        overdue ? "font-bold text-danger" : "font-semibold"
                      }
                    >
                      {formatDate(r.effective_date)}
                    </span>
                    {overdue && (
                      <div className="text-[10px] font-bold uppercase text-danger">
                        Overdue
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {r.label}
                    {r.jurisdictional && (
                      <span className="ml-2 rounded bg-danger-bg px-1.5 py-0.5 text-[10px] font-bold text-danger">
                        JX
                      </span>
                    )}
                    {r.source === "court_order" && (
                      <span className="ml-2 rounded bg-info-bg px-1.5 py-0.5 text-[10px] font-bold text-info">
                        COURT ORDER
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {r.client_matter_id ? (
                      <Link
                        href={`/litigation/${r.client_matter_id}`}
                        className="font-semibold text-accent-dk no-underline hover:underline"
                      >
                        {r.display_name ?? "Matter"}
                      </Link>
                    ) : (
                      r.display_name ?? "—"
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-muted">
                    {r.source ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-xs text-muted">
                    {r.authority ?? "—"}
                    {r.authority && (
                      <div className="mt-0.5 text-[10px] font-bold uppercase text-danger">
                        ATTORNEY-VERIFY
                      </div>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </section>
  );
}
