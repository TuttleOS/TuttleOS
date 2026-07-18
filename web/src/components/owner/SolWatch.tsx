import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { STAGE_LABEL } from "@/lib/cases/types";
import {
  matterHref,
  reconciliationLabel,
  type SolRow,
} from "@/lib/owner/types";

export function SolWatch({ rows }: { rows: SolRow[] }) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-accent-dk">
          Owner dashboard
        </p>
        <h1 className="text-2xl font-bold">SOL Watch</h1>
        <p className="text-sm text-muted">
          Stored vs engine-computed from{" "}
          <code className="text-xs">core.v_sol_reconciliation</code>. Engine
          never overwrites stored SOL.
        </p>
        <p className="mt-1 text-xs font-bold uppercase text-danger">
          ATTORNEY-VERIFY — rule-computed dates require attorney review
        </p>
      </div>

      <section className="overflow-hidden rounded-panel border border-grid bg-surface shadow-soft">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-grid text-xs text-muted">
              <th className="px-4 py-2.5 font-semibold">Client</th>
              <th className="px-4 py-2.5 font-semibold">Stored</th>
              <th className="px-4 py-2.5 font-semibold">Computed</th>
              <th className="px-4 py-2.5 font-semibold">Δ days</th>
              <th className="px-4 py-2.5 font-semibold">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-muted">
                  No matters in SOL reconciliation.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const hot =
                  r.reconciliation ===
                    "STORED_LATER_REVIEW_tolling_or_error" ||
                  r.reconciliation === "no_stored_value";
                return (
                  <tr
                    key={r.client_matter_id}
                    className={`border-b border-grid ${
                      hot ? "bg-danger-bg/40" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={matterHref(
                          r.current_stage_code,
                          r.client_matter_id,
                        )}
                        className="font-semibold text-accent-dk no-underline hover:underline"
                      >
                        {r.client}
                      </Link>
                      <div className="text-xs text-muted">
                        {STAGE_LABEL[r.current_stage_code] ??
                          r.current_stage_code}
                        {r.sol_status ? ` · ${r.sol_status}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.stored_sol ? (
                        <>
                          {formatDate(r.stored_sol)}
                          <div className="font-bold uppercase text-danger">
                            ATTORNEY-VERIFY
                          </div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.computed_sol ? (
                        <>
                          {formatDate(r.computed_sol)}
                          <div className="font-bold uppercase text-danger">
                            ATTORNEY-VERIFY
                          </div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.delta_days != null ? r.delta_days : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold">
                      {reconciliationLabel(r.reconciliation)}
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
