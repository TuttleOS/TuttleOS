import Link from "next/link";
import type { DemandReadinessRow } from "@/lib/phase7/queries";

export function DemandQueueSkeleton({ rows }: { rows: DemandReadinessRow[] }) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-accent-dk">
          Phase 7 · skeleton
        </p>
        <h1 className="text-2xl font-bold">Demand Writer queue</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Read-only from{" "}
          <code className="text-xs">resolution.v_demand_readiness</code>{" "}
          (records/demand stages). No send/approve actions until Michael signs
          screen proposals — see{" "}
          <code className="text-xs">docs/PHASE7_SCREEN_PROPOSALS.md</code>.
        </p>
      </div>

      <section className="overflow-hidden rounded-panel border border-grid bg-surface shadow-soft">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-grid text-xs text-muted">
              <th className="px-4 py-2.5 font-semibold">Client</th>
              <th className="px-4 py-2.5 font-semibold">Level</th>
              <th className="px-4 py-2.5 font-semibold">Treatment</th>
              <th className="px-4 py-2.5 font-semibold">Records out</th>
              <th className="px-4 py-2.5 font-semibold">PD clear</th>
              <th className="px-4 py-2.5 font-semibold">Kate / Atty</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-muted">
                  No matters in records/demand stage. Demo fixtures are mostly
                  litigation — empty here is expected until demand-stage data
                  exists.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={`${r.client_matter_id}-${r.demand_id ?? "none"}`}
                  className="border-b border-grid"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/cases/${r.client_matter_id}`}
                      className="font-semibold text-accent-dk no-underline hover:underline"
                    >
                      {r.display_name ?? "Matter"}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {r.approved_level != null ? `L${r.approved_level}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.treatment_complete ? "Complete" : "Open"}
                  </td>
                  <td className="px-4 py-3">{r.records_outstanding ?? 0}</td>
                  <td className="px-4 py-3 text-xs">
                    {r.pd_clear ? "Yes" : "No"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.kate_reviewed ? "Kate ✓" : "Kate —"}
                    {" · "}
                    {r.needs_attorney_approval
                      ? r.attorney_approved
                        ? "Atty ✓"
                        : "Atty needed"
                      : "—"}
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
