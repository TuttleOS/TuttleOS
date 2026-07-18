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

type Tone = "warn" | "crit" | "info";

function flagTone(label: string): Tone {
  if (
    /SOL|Missing Level|filing deadline|Viability overdue/i.test(label) ||
    label.includes("SOL")
  ) {
    return "crit";
  }
  if (/overdue|aging|unresolved|PD|Demand|Records|Disbursement|contact/i.test(label)) {
    return "warn";
  }
  return "info";
}

function flagChipClass(tone: Tone): string {
  if (tone === "crit") return "bg-danger-bg text-danger";
  if (tone === "warn") return "bg-warning-bg text-warning";
  return "bg-accent-lt text-accent-dk";
}

function displayFlag(label: string): string {
  if (label === "SOL < 120d") return "Filing deadline < 120 days";
  if (label === "Missing Level") return "Missing case Level";
  if (label === "Viability overdue") return "7-day review overdue";
  if (label === "PD unresolved") return "Property damage open";
  return label;
}

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

  const needsNow = useMemo(() => {
    const items: {
      key: string;
      title: string;
      detail: string;
      count: number;
      tone: Tone;
      href?: string;
      filterKey?: string;
    }[] = [];

    if (tiles.pendingApprovals > 0) {
      items.push({
        key: "approvals",
        title: "Waiting on your approval",
        detail: "Levels, L3 demands, and related decisions",
        count: tiles.pendingApprovals,
        tone: "crit",
        href: "/owner/approvals",
      });
    }
    if (tiles.solSoon > 0) {
      items.push({
        key: "sol",
        title: "Filing deadline within 120 days",
        detail: "Open SOL Watch for the full list",
        count: tiles.solSoon,
        tone: "crit",
        href: "/owner/sol",
      });
    }
    if (tiles.missingLevel > 0) {
      items.push({
        key: "level",
        title: "Missing case Level",
        detail: "Case managers are waiting on Level assignment",
        count: tiles.missingLevel,
        tone: "warn",
        filterKey: "missing_level",
      });
    }
    if (tiles.viability > 0) {
      items.push({
        key: "viability",
        title: "7-day review overdue",
        detail: "Viability reviews past due",
        count: tiles.viability,
        tone: "warn",
        filterKey: "viability",
      });
    }
    if (tiles.solMismatches > 0) {
      items.push({
        key: "mismatch",
        title: "SOL date mismatches",
        detail: "Stored vs computed filing deadlines disagree",
        count: tiles.solMismatches,
        tone: "crit",
        href: "/owner/sol",
      });
    }
    return items;
  }, [tiles]);

  function applyFilter(key: string) {
    setFilter(key);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-accent-dk">
          Owner
        </p>
        <h1 className="text-2xl font-bold">Firm attention</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Cases and flags that need a look across the firm — approvals, filing
          deadlines, and stalled work. Click a client name to open the case.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
          Needs you now
        </h2>
        {needsNow.length === 0 ? (
          <div className="rounded-panel border border-success/30 bg-success-bg/40 px-4 py-3 text-sm text-success">
            Nothing urgent in the current practice data. Use the filters below
            to browse the firm queue.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {needsNow.map((item) => {
              const className = `block rounded-panel border border-grid bg-surface px-4 py-3 text-left shadow-soft transition hover:bg-surface-2 ${
                item.tone === "crit"
                  ? "border-l-4 border-l-danger"
                  : item.tone === "warn"
                    ? "border-l-4 border-l-warning"
                    : "border-l-4 border-l-accent-dk"
              }`;
              const body = (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-bold">{item.title}</div>
                    <div className="text-2xl font-bold tabular-nums">
                      {item.count}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted">{item.detail}</p>
                </>
              );
              if (item.href) {
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`${className} no-underline text-ink`}
                  >
                    {body}
                  </Link>
                );
              }
              return (
                <button
                  key={item.key}
                  type="button"
                  className={className}
                  onClick={() =>
                    item.filterKey ? applyFilter(item.filterKey) : undefined
                  }
                >
                  {body}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
          At a glance
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Tile label="Active matters" value={tiles.active} />
          <Tile
            href="/owner/sol"
            label="Filing deadline soon"
            sub="Within 120 days"
            value={tiles.solSoon}
            tone={tiles.solSoon ? "crit" : undefined}
          />
          <Tile
            label="Missing case Level"
            value={tiles.missingLevel}
            tone={tiles.missingLevel ? "warn" : undefined}
            onClick={() => applyFilter("missing_level")}
          />
          <Tile
            label="7-day review overdue"
            value={tiles.viability}
            tone={tiles.viability ? "warn" : undefined}
            onClick={() => applyFilter("viability")}
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
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">Cases needing attention</h2>
            <p className="text-sm text-muted">
              Showing {rows.length} of {stalled.length} flagged or active
              matters in this view.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {OWNER_FLAG_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => applyFilter(f.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                filter === f.key
                  ? "bg-accent-dk text-white"
                  : "border border-grid bg-surface text-ink hover:bg-surface-2"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-panel border border-grid bg-surface shadow-soft">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-grid bg-surface-2/50 text-xs text-muted">
                <th className="px-4 py-3 font-semibold">Client</th>
                <th className="px-4 py-3 font-semibold">Stage</th>
                <th className="px-4 py-3 font-semibold">Age / in stage</th>
                <th className="px-4 py-3 font-semibold">Level</th>
                <th className="px-4 py-3 font-semibold">Flags</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted">
                    No cases match this filter. Try{" "}
                    <button
                      type="button"
                      className="font-semibold text-accent-dk underline"
                      onClick={() => applyFilter("all")}
                    >
                      All cases
                    </button>
                    .
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const flags = flagList(r);
                  return (
                    <tr
                      key={r.client_matter_id}
                      className="border-b border-grid last:border-0 hover:bg-surface-2/60"
                    >
                      <td className="px-4 py-3.5 align-top">
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
                          Case manager:{" "}
                          {r.case_manager ?? (
                            <span className="font-semibold text-danger">
                              Unassigned
                            </span>
                          )}
                        </div>
                        {r.critical_note && (
                          <div className="mt-1 max-w-md text-xs text-warning">
                            {r.critical_note}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <span className="inline-block rounded-md bg-accent-lt px-2 py-0.5 text-xs font-semibold text-accent-dk">
                          {STAGE_LABEL[r.current_stage_code] ??
                            r.current_stage_code}
                        </span>
                        <div className="mt-1 text-xs text-muted">
                          since {formatDate(r.stage_entered_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-top text-xs tabular-nums">
                        {r.case_age_days != null ? `${r.case_age_days}d old` : "—"}
                        <div className="text-muted">
                          {r.days_in_stage != null
                            ? `${r.days_in_stage}d in stage`
                            : "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        {r.approved_level != null ? (
                          <span className="font-semibold">
                            L{r.approved_level}
                          </span>
                        ) : (
                          <span className="font-semibold text-danger">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <div className="flex flex-wrap gap-1">
                          {flags.length === 0 ? (
                            <span className="text-xs text-muted">—</span>
                          ) : (
                            flags.map((f) => {
                              const shown = displayFlag(f);
                              const tone = flagTone(f);
                              return (
                                <span
                                  key={f}
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${flagChipClass(tone)}`}
                                >
                                  {shown}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {overrides.length > 0 && (
        <section className="rounded-panel border border-grid bg-surface p-5 shadow-soft">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
            Checklist overrides — last 90 days
          </h2>
          <p className="mt-1 text-xs text-muted">
            Staff marked a checklist item done with a reason instead of the
            usual completion path — useful for spotting process drift.
          </p>
          <ul className="mt-3 space-y-2.5 text-sm">
            {overrides.slice(0, 8).map((o, i) => (
              <li
                key={`${o.staff}-${o.title}-${i}`}
                className="rounded-lg border border-grid bg-page/60 px-3 py-2"
              >
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
                  <div className="mt-0.5 text-xs text-muted">
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
  sub,
  tone,
  href,
  onClick,
}: {
  label: string;
  value: number;
  sub?: string;
  tone?: "warn" | "crit";
  href?: string;
  onClick?: () => void;
}) {
  const className = `block rounded-panel border border-grid bg-surface px-4 py-3 text-left shadow-soft ${
    tone === "crit"
      ? "border-l-4 border-l-danger"
      : tone === "warn"
        ? "border-l-4 border-l-warning"
        : ""
  }`;

  const inner = (
    <>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs font-semibold text-ink">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted">{sub}</div>}
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
