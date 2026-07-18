import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { STAGE_LABEL } from "@/lib/cases/types";
import type { LienWorklistRow } from "@/lib/phase7/queries";

function money(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function LienWorklistSkeleton({ rows }: { rows: LienWorklistRow[] }) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-accent-dk">
          Phase 7 · skeleton
        </p>
        <h1 className="text-2xl font-bold">Lien worklist</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Read-only from{" "}
          <code className="text-xs">liens.v_lien_worklist</code>. Finance-tier
          RLS still applies — intake cannot see this via API. No resolve /
          negotiate actions until owner sign-off.
        </p>
      </div>

      <section className="overflow-hidden rounded-panel border border-grid bg-surface shadow-soft">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-grid text-xs text-muted">
              <th className="px-4 py-2.5 font-semibold">Client</th>
              <th className="px-4 py-2.5 font-semibold">Type / holder</th>
              <th className="px-4 py-2.5 font-semibold">Status</th>
              <th className="px-4 py-2.5 font-semibold">Asserted</th>
              <th className="px-4 py-2.5 font-semibold">Settled?</th>
              <th className="px-4 py-2.5 font-semibold">Flagged</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-muted">
                  No open liens in worklist. Empty until lien rows exist for
                  demo or production matters.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.lien_id} className="border-b border-grid">
                  <td className="px-4 py-3">
                    <Link
                      href={`/cases/${r.client_matter_id}`}
                      className="font-semibold text-accent-dk no-underline hover:underline"
                    >
                      {r.display_name ?? "Matter"}
                    </Link>
                    <div className="text-xs text-muted">
                      {STAGE_LABEL[r.current_stage_code ?? ""] ??
                        r.current_stage_code}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="font-semibold">{r.lien_type ?? "—"}</div>
                    <div className="text-muted">{r.holder ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">{r.status}</td>
                  <td className="px-4 py-3 text-xs">{money(r.asserted_amount)}</td>
                  <td className="px-4 py-3 text-xs">
                    {r.matter_settled ? "Yes" : "No"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {formatDate(r.flagged_for_resolution_date)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
