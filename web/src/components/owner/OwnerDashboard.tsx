"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDate } from "@/lib/dates";
import { STAGE_LABEL, flagList, type StalledRow } from "@/lib/cases/types";
import {
  OWNER_FLAG_FILTERS,
  matterHref,
  type OverridePattern,
} from "@/lib/owner/types";

export function OwnerDashboard({
  stalled,
  tiles,
  overrides,
  initialFilter = "all",
}: {
  stalled: StalledRow[];
  tiles: {
    active: number;
    solSoon: number;
    missingLevel: number;
    viability: number;
    pendingApprovals: number;
    solMismatches: number;
  };
  overrides: OverridePattern[];
  initialFilter?: string;
}) {
  const [filter, setFilter] = useState(() =>
    OWNER_FLAG_FILTERS.some((f) => f.key === initialFilter)
      ? initialFilter
      : "all",
  );

  const rows = useMemo(() => {
    const fn =
      OWNER_FLAG_FILTERS.find((f) => f.key === filter)?.match ?? (() => true);
    return stalled.filter(fn);
  }, [stalled, filter]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-accent-dk">
          Owner dashboard
        </p>
        <h1 className="text-2xl font-bold">Stalled Cases</h1>
        <p className="text-sm text-muted">
          Firm-wide attention queue. Filters map to{" "}
          <code className="text-xs">workflow.v_stalled_cases</code> flags.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Tile label="Active matters" value={tiles.active} />
        <Tile
          href="/owner/sol"
          label="SOL < 120d"
          value={tiles.solSoon}
          tone={tiles.solSoon ? "crit" : undefined}
        />
        <Tile
          href="/owner?flag=missing_level"
          label="Missing Level"
          value={tiles.missingLevel}
          tone={tiles.missingLevel ? "warn" : undefined}
          onClick={() => setFilter("missing_level")}
        />
        <Tile
          label="Viability overdue"
          value={tiles.viability}
          tone={tiles.viability ? "warn" : undefined}
          onClick={() => setFilter("viability")}
        />
        <Tile
          href="/owner/approvals"
          label="Pending approvals"
          value={tiles.pendingApprovals}
          tone={tiles.pendingApprovals ? "warn" : undefined}
        />
        <Tile
          href="/owner/sol"
          label="SOL mismatches"
          value={tiles.solMismatches}
          tone={tiles.solMismatches ? "crit" : undefined}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {OWNER_FLAG_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
              filter === f.key
                ? "bg-accent-dk text-white"
                : "border border-grid bg-surface text-ink hover:bg-surface-2"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-panel border border-grid bg-surface shadow-soft">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-grid text-xs text-muted">
              <th className="px-4 py-2.5 font-semibold">Client</th>
              <th className="px-4 py-2.5 font-semibold">Stage</th>
              <th className="px-4 py-2.5 font-semibold">Age / stage</th>
              <th className="px-4 py-2.5 font-semibold">Level</th>
              <th className="px-4 py-2.5 font-semibold">Flags</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-muted">
                  No matters match this filter.
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
                        href={matterHref(
                          r.current_stage_code,
                          r.client_matter_id,
                        )}
                        className="font-semibold text-accent-dk no-underline hover:underline"
                      >
                        {r.display_name}
                      </Link>
                      {r.tbi_indicated && (
                        <span className="ml-2 rounded bg-danger-bg px-1.5 py-0.5 text-[10px] font-bold text-danger">
                          TBI
                        </span>
                      )}
                      <div className="mt-0.5 text-xs text-muted">
                        CM: {r.case_manager ?? (
                          <span className="text-danger">UNASSIGNED</span>
                        )}
                      </div>
                      {r.critical_note && (
                        <div className="mt-1 max-w-md truncate text-xs text-warning">
                          {r.critical_note}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {STAGE_LABEL[r.current_stage_code] ??
                        r.current_stage_code}
                      <div className="text-muted">
                        since {formatDate(r.stage_entered_at)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.case_age_days != null ? `${r.case_age_days}d` : "—"}
                      {" / "}
                      {r.days_in_stage != null
                        ? `${r.days_in_stage}d in stage`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {r.approved_level != null ? (
                        `L${r.approved_level}`
                      ) : (
                        <span className="font-semibold text-danger">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {flags.length === 0 ? (
                          <span className="text-xs text-muted">—</span>
                        ) : (
                          flags.map((f) => (
                            <span
                              key={f}
                              className="rounded bg-danger-bg px-1.5 py-0.5 text-[10px] font-semibold text-danger"
                            >
                              {f}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {overrides.length > 0 && (
        <section className="rounded-panel border border-grid bg-surface p-5 shadow-soft">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
            Override patterns (90d)
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {overrides.slice(0, 8).map((o, i) => (
              <li key={`${o.staff}-${o.title}-${i}`}>
                <span className="font-semibold">{o.staff}</span>
                {" — "}
                {o.title}
                <span className="text-muted">
                  {" "}
                  · {o.overrides_90d}×
                  {o.most_recent
                    ? ` · last ${formatDate(o.most_recent)}`
                    : ""}
                </span>
                {o.recent_reasons?.[0] && (
                  <div className="text-xs text-muted">
                    “{o.recent_reasons[0]}”
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
  href,
  onClick,
}: {
  label: string;
  value: number;
  tone?: "warn" | "crit";
  href?: string;
  onClick?: () => void;
}) {
  const className = `block rounded-panel border border-grid bg-surface px-4 py-3 text-left shadow-soft ${
    tone === "crit"
      ? "border-danger/40"
      : tone === "warn"
        ? "border-warning/40"
        : ""
  }`;

  const inner = (
    <>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </>
  );

  if (href && !onClick) {
    return (
      <Link href={href} className={`${className} no-underline text-ink`}>
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {inner}
      </button>
    );
  }

  return <div className={className}>{inner}</div>;
}
