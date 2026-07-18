import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { caseTypeLabel } from "@/lib/intake/case-types";
import { STAGE_LABEL } from "@/lib/cases/types";
import type { LitCaseloadRow } from "@/lib/litigation/types";

export function LitCaseload({ rows }: { rows: LitCaseloadRow[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const tiles = {
    active: rows.length,
    jxSoon: rows.filter(
      (r) =>
        r.next_deadline_jx &&
        r.next_deadline_date &&
        r.next_deadline_date <= today,
    ).length,
    noCause: rows.filter((r) => !r.cause_number).length,
    unassignedPl: rows.filter((r) => !r.pl_name).length,
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-accent-dk">
          Litigation Paralegal workspace
        </p>
        <h1 className="text-2xl font-bold">My Cases</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Active litigation" value={tiles.active} />
        <Tile
          label="JX overdue / due"
          value={tiles.jxSoon}
          tone={tiles.jxSoon ? "crit" : undefined}
        />
        <Tile label="No cause number" value={tiles.noCause} tone="warn" />
        <Tile label="PL unassigned" value={tiles.unassignedPl} tone="warn" />
      </div>

      <section className="overflow-hidden rounded-panel border border-grid bg-surface shadow-soft">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-grid text-xs text-muted">
              <th className="px-4 py-2.5 font-semibold">Client</th>
              <th className="px-4 py-2.5 font-semibold">Cause / court</th>
              <th className="px-4 py-2.5 font-semibold">Level</th>
              <th className="px-4 py-2.5 font-semibold">Next deadline</th>
              <th className="px-4 py-2.5 font-semibold">SOL</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-muted">
                  No litigation matters on this caseload.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.client_matter_id}
                  className="border-b border-grid hover:bg-surface-2/60"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/litigation/${r.client_matter_id}`}
                      className="font-semibold text-accent-dk no-underline hover:underline"
                    >
                      {r.display_name}
                    </Link>
                    <div className="mt-1 text-xs text-muted">
                      {caseTypeLabel(r.case_type_code)}
                      {r.preferred_language === "es" ? " · Spanish" : ""}
                      {" · "}
                      CM: {r.cm_name ?? (
                        <span className="text-danger">UNASSIGNED</span>
                      )}
                      {" · "}
                      PL: {r.pl_name ?? (
                        <span className="text-warning">UNASSIGNED</span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted">
                      {STAGE_LABEL[r.current_stage_code] ??
                        r.current_stage_code}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="font-semibold">
                      {r.cause_number ?? "— not filed —"}
                    </div>
                    <div className="text-muted">{r.court_name ?? "—"}</div>
                    {r.filed_date && (
                      <div className="text-muted">
                        Filed {formatDate(r.filed_date)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.discovery_level != null ? `L${r.discovery_level}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.next_deadline_date ? (
                      <>
                        <div className="font-semibold">
                          {formatDate(r.next_deadline_date)}
                          {r.next_deadline_jx && (
                            <span className="ml-1 rounded bg-danger-bg px-1 text-[10px] font-bold text-danger">
                              JX
                            </span>
                          )}
                        </div>
                        <div className="text-muted">{r.next_deadline_label}</div>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.sol_date ? (
                      <>
                        {formatDate(r.sol_date)}
                        <div className="font-bold uppercase text-danger">
                          ATTORNEY-VERIFY
                        </div>
                      </>
                    ) : (
                      "—"
                    )}
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

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warn" | "crit";
}) {
  return (
    <div
      className={`rounded-panel border border-grid bg-surface px-4 py-3 shadow-soft ${
        tone === "crit"
          ? "border-danger/40"
          : tone === "warn"
            ? "border-warning/40"
            : ""
      }`}
    >
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
