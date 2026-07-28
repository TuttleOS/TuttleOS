import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { caseTypeLabel } from "@/lib/intake/case-types";
import { STAGE_LABEL } from "@/lib/cases/types";
import type { LitCaseloadRow } from "@/lib/litigation/types";
import { RoleAttentionNotices } from "@/components/workspace/RoleAttentionNotices";
import { litAttentionCards } from "@/lib/workspace/attentionNotices";

export function LitCaseload({ rows }: { rows: LitCaseloadRow[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const cards = litAttentionCards(rows);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-accent-dk">
          Litigation Paralegal workspace
        </p>
        <h1 className="text-2xl font-bold">My Cases</h1>
        <p className="mt-1 text-sm text-muted">
          Assigned litigation only — deadline risk first, then the full list.
        </p>
      </div>

      <RoleAttentionNotices
        title="Needs attention"
        subtitle="Your assigned lit matters — JX deadlines, cause number, PL assignment"
        cards={cards}
        emptyHint="Nothing flagged on your assigned litigation caseload."
        primaryCta={{ href: "/litigation/deadlines", label: "Deadline horizon" }}
      />

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
              <th className="px-4 py-2.5 font-semibold">Cause / court</th>
              <th className="px-4 py-2.5 font-semibold">Discovery</th>
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
                      CM:{" "}
                      {r.cm_name ?? (
                        <span className="text-danger">UNASSIGNED</span>
                      )}
                      {" · "}
                      PL:{" "}
                      {r.pl_name ?? (
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
                      {r.cause_number ?? (
                        <span className="text-warning">No cause #</span>
                      )}
                    </div>
                    <div className="text-muted">{r.court_name ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3">
                    {r.discovery_level != null ? `D${r.discovery_level}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.next_deadline_date ? (
                      <>
                        <div
                          className={
                            r.next_deadline_jx &&
                            r.next_deadline_date <= today
                              ? "font-bold text-danger"
                              : ""
                          }
                        >
                          {formatDate(r.next_deadline_date)}
                        </div>
                        <div className="text-muted">
                          {r.next_deadline_label ?? "Deadline"}
                        </div>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.sol_date ? formatDate(r.sol_date) : "—"}
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
