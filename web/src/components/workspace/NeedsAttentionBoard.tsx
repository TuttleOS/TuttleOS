import Link from "next/link";
import { formatDate } from "@/lib/dates";
import {
  flagList,
  needsAttention,
  STAGE_LABEL,
  type CaseloadRow,
} from "@/lib/cases/types";

type AttentionMatter = Pick<
  CaseloadRow,
  | "client_matter_id"
  | "display_name"
  | "current_stage_code"
  | "flag_provider_check_overdue"
  | "open_checklist"
  | "sol_date"
> &
  Partial<CaseloadRow>;

/**
 * Assigned cases that need attention — weighted list, not a numbers strip
 * (ROLES §8.1#7).
 */
export function NeedsAttentionBoard({
  rows,
  hrefBase = "/cases",
  emptyHint = "Nothing flagged on your assigned caseload.",
}: {
  rows: AttentionMatter[];
  hrefBase?: string;
  emptyHint?: string;
}) {
  const hot = rows
    .filter((r) => needsAttention(r as CaseloadRow) || (r.open_checklist ?? 0) > 0)
    .slice(0, 12);

  return (
    <section className="rounded-panel border border-grid bg-surface shadow-soft">
      <div className="border-b border-grid px-4 py-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-accent-dk">
          Needs attention
        </h2>
        <p className="mt-0.5 text-xs text-muted">
          Your assigned matters with red flags or open checklist work — open the
          file, not a count.
        </p>
      </div>
      {hot.length === 0 ? (
        <p className="px-4 py-8 text-sm text-muted">{emptyHint}</p>
      ) : (
        <ul className="divide-y divide-grid">
          {hot.map((r) => {
            const flags = flagList(r as CaseloadRow);
            return (
              <li key={r.client_matter_id}>
                <Link
                  href={`${hrefBase}/${r.client_matter_id}`}
                  className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 no-underline hover:bg-surface-2/60"
                >
                  <div>
                    <div className="font-semibold text-accent-dk">
                      {r.display_name}
                    </div>
                    <div className="text-xs text-muted">
                      {STAGE_LABEL[r.current_stage_code] ?? r.current_stage_code}
                      {r.sol_date ? ` · SOL ${formatDate(r.sol_date)}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {flags.slice(0, 4).map((f) => (
                      <span
                        key={f}
                        className="rounded bg-danger-bg px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-danger"
                      >
                        {f}
                      </span>
                    ))}
                    {(r.open_checklist ?? 0) > 0 && (
                      <span className="rounded bg-warning-bg px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
                        Checklist {r.open_checklist}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
