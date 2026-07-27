import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { caseTypeLabel } from "@/lib/intake/case-types";
import {
  flagList,
  STAGE_LABEL,
  type CaseloadRow,
} from "@/lib/cases/types";
import { NeedsAttentionBoard } from "@/components/workspace/NeedsAttentionBoard";

export function Caseload({ rows }: { rows: CaseloadRow[] }) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-accent-dk">
          Case Manager workspace
        </p>
        <h1 className="text-2xl font-bold">My Caseload</h1>
        <p className="mt-1 text-sm text-muted">
          Assigned matters only — start with what needs attention, then the full
          list.
        </p>
      </div>

      <NeedsAttentionBoard rows={rows} hrefBase="/cases" />

      <section className="overflow-hidden rounded-panel border border-grid bg-surface shadow-soft">
        <div className="border-b border-grid px-4 py-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
            All assigned ({rows.length})
          </h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-grid text-xs text-muted">
              <th className="px-4 py-2.5 font-semibold">Client</th>
              <th className="px-4 py-2.5 font-semibold">Stage</th>
              <th className="px-4 py-2.5 font-semibold">Age / in stage</th>
              <th className="px-4 py-2.5 font-semibold">Level</th>
              <th className="px-4 py-2.5 font-semibold">SOL</th>
              <th className="px-4 py-2.5 font-semibold">Flags</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-muted">
                  No active matters on this caseload yet. Convert a signed lead
                  from Intake, or assign yourself as case manager.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const flags = flagList(r);
                return (
                  <tr
                    key={r.client_matter_id}
                    className="border-b border-grid hover:bg-surface-2/60"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/cases/${r.client_matter_id}`}
                        className="font-semibold text-accent-dk no-underline hover:underline"
                      >
                        {r.display_name}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {r.tbi_indicated && (
                          <Badge tone="crit">TBI</Badge>
                        )}
                        {r.minor_or_incapacitated && (
                          <Badge tone="warn">MINOR</Badge>
                        )}
                        {r.companion_count > 1 && (
                          <Badge>N of {r.companion_count}</Badge>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted">
                        {caseTypeLabel(r.case_type_code)}
                        {r.preferred_language === "es" ? " · Spanish" : ""}
                        {" · "}
                        CM: {r.cm_name ?? (
                          <span className="font-semibold text-danger">
                            UNASSIGNED
                          </span>
                        )}
                        {" · "}
                        PL: {r.pl_name ?? (
                          <span className="text-warning">UNASSIGNED</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {STAGE_LABEL[r.current_stage_code] ??
                        r.current_stage_code}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.case_age_days ?? "—"}d
                      <span className="text-muted">
                        {" "}
                        / {r.days_in_stage ?? "—"}d in stage
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.approved_level != null ? (
                        `L${r.approved_level}`
                      ) : (
                        <span className="text-danger">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.sol_date ? (
                        <>
                          {formatDate(r.sol_date)}
                          {r.flag_sol_within_120d && (
                            <div className="font-bold uppercase text-danger">
                              ATTORNEY-VERIFY
                            </div>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {flags.length === 0 ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {flags.slice(0, 3).map((f) => (
                            <Badge key={f} tone="crit">
                              {f}
                            </Badge>
                          ))}
                          {flags.length > 3 && (
                            <span className="text-xs text-muted">
                              +{flags.length - 3}
                            </span>
                          )}
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
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "warn" | "crit";
}) {
  const cls =
    tone === "crit"
      ? "bg-danger-bg text-danger"
      : tone === "warn"
        ? "bg-warning-bg text-warning"
        : "bg-surface-2 text-muted";
  return (
    <span
      className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${cls}`}
    >
      {children}
    </span>
  );
}
