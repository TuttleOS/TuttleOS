"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatDate } from "@/lib/dates";
import { STAGE_LABEL, flagList, type StalledRow } from "@/lib/cases/types";
import {
  OWNER_FLAG_FILTERS,
  matterHref,
  type ApprovalItem,
  type OverridePattern,
} from "@/lib/owner/types";

type Tone = "warn" | "crit" | "info" | "ok";

function primaryIssue(row: StalledRow): { label: string; tone: Tone; category: string } {
  if (row.flag_sol_within_120d)
    return {
      label: "Filing deadline < 120 days",
      tone: "crit",
      category: "Jurisdictional",
    };
  if (row.flag_missing_level)
    return { label: "Missing case Level", tone: "crit", category: "Approval" };
  if (row.flag_viability_overdue)
    return {
      label: "7-day review overdue",
      tone: "warn",
      category: "Watch",
    };
  if (row.flag_demand_response_overdue)
    return {
      label: "Demand response late",
      tone: "warn",
      category: "Watch",
    };
  if (row.flag_pd_unresolved)
    return {
      label: "Property damage open",
      tone: "warn",
      category: "Watch",
    };
  if (row.flag_provider_check_overdue)
    return {
      label: "Provider call overdue",
      tone: "warn",
      category: "Watch",
    };
  if (row.flag_records_not_ordered)
    return { label: "Records aging", tone: "warn", category: "Watch" };
  if (row.flag_disbursement_aging)
    return {
      label: "Disbursement aging",
      tone: "warn",
      category: "Watch",
    };
  if (row.flag_no_client_contact_30d)
    return {
      label: "No client contact 30d",
      tone: "info",
      category: "Client contact",
    };
  if (!row.case_manager)
    return {
      label: "Case manager UNASSIGNED",
      tone: "crit",
      category: "Assignment",
    };
  if (row.critical_note)
    return {
      label: row.critical_note.slice(0, 80),
      tone: "info",
      category: "Note",
    };
  return { label: "Needs attention", tone: "info", category: "Watch" };
}

function nextAction(row: StalledRow): string {
  if (row.flag_missing_level) return "Assign / approve Level";
  if (row.flag_sol_within_120d) return "Review SOL Watch";
  if (row.flag_viability_overdue) return "Complete 7-day review";
  if (!row.case_manager) return "Assign case manager";
  if (row.flag_provider_check_overdue) return "Log provider call";
  if (row.flag_pd_unresolved) return "Update PD status";
  if (row.flag_demand_response_overdue) return "Chase demand response";
  return "Open case";
}

function storyTitle(row: StalledRow): string {
  if (row.flag_sol_within_120d) return "Texas filing deadline";
  if (row.flag_missing_level) return "Level approval needed";
  if (!row.case_manager) return "Missing case manager";
  if (row.flag_provider_check_overdue) return "Provider call overdue";
  if (row.flag_viability_overdue) return "7-day review overdue";
  if (row.flag_demand_response_overdue) return "Demand response late";
  if (row.flag_pd_unresolved) return "Property damage open";
  if (row.flag_records_not_ordered) return "Records aging";
  if (row.flag_no_client_contact_30d) return "Client contact gap";
  return nextAction(row);
}

function workspaceLabel(stage: string): string {
  if (stage === "litigation") return "Litigation";
  if (stage === "intake" || stage === "viability") return "Intake / Review";
  return "Case Manager";
}

function stageProgress(stage: string): number {
  const order = [
    "intake",
    "viability",
    "treatment",
    "records",
    "demand",
    "negotiation",
    "litigation",
    "settlement",
  ];
  const i = order.indexOf(stage);
  if (i < 0) return 35;
  return Math.round(((i + 1) / order.length) * 100);
}

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function statusBadge(
  row: StalledRow,
  issue: ReturnType<typeof primaryIssue>,
  cleared: boolean,
): { label: string; tone: Tone } {
  if (cleared) return { label: "✓ Clear", tone: "ok" };
  if (row.flag_sol_within_120d) return { label: "× JX · Verify", tone: "crit" };
  if (issue.tone === "crit") return { label: `× ${issue.category}`, tone: "crit" };
  if (issue.tone === "warn") return { label: "Δ Watch", tone: "warn" };
  return { label: "● Info", tone: "info" };
}

function badgeClass(tone: Tone): string {
  if (tone === "crit") return "bg-danger-bg text-danger";
  if (tone === "warn") return "bg-warning-bg text-warning";
  if (tone === "ok") return "bg-success-bg text-success";
  return "bg-accent-lt text-accent-dk";
}

function toneDot(tone: Tone): string {
  if (tone === "crit") return "bg-danger";
  if (tone === "warn") return "bg-warning";
  if (tone === "ok") return "bg-success";
  return "bg-accent";
}

function greetingHour(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function todayLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function OwnerDashboard({
  stalled,
  tiles,
  approvals,
  overrides,
  firstName,
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
  approvals: ApprovalItem[];
  overrides: OverridePattern[];
  firstName: string;
  initialFilter?: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState(() =>
    OWNER_FLAG_FILTERS.some((f) => f.key === initialFilter)
      ? initialFilter
      : "all",
  );
  const [showCleared, setShowCleared] = useState(false);

  const attentionRows = useMemo(() => {
    return stalled.filter(
      (r) =>
        r.flag_missing_level ||
        r.flag_sol_within_120d ||
        r.flag_viability_overdue ||
        r.flag_pd_unresolved ||
        r.flag_demand_response_overdue ||
        r.flag_records_not_ordered ||
        r.flag_disbursement_aging ||
        r.flag_no_client_contact_30d ||
        r.flag_provider_check_overdue ||
        !r.case_manager,
    );
  }, [stalled]);

  const clearedRows = useMemo(() => {
    const ids = new Set(attentionRows.map((r) => r.client_matter_id));
    return stalled.filter((r) => !ids.has(r.client_matter_id));
  }, [stalled, attentionRows]);

  const rows = useMemo(() => {
    const base = showCleared ? clearedRows : attentionRows;
    const fn =
      OWNER_FLAG_FILTERS.find((f) => f.key === filter)?.match ?? (() => true);
    if (filter === "all" && !showCleared) return attentionRows;
    if (filter === "all" && showCleared) return clearedRows;
    return base.filter(fn);
  }, [attentionRows, clearedRows, filter, showCleared]);

  const unassignedCount = stalled.filter((r) => !r.case_manager).length;
  const needCount =
    attentionRows.length + tiles.pendingApprovals + tiles.solMismatches;

  const storyCards = useMemo(() => {
    type Card = {
      key: string;
      category: string;
      tone: Tone;
      title: string;
      body: string;
      meta: string;
      href: string;
    };
    const cards: Card[] = [];

    for (const r of attentionRows.slice(0, 3)) {
      const issue = primaryIssue(r);
      cards.push({
        key: r.client_matter_id,
        category: issue.category.toUpperCase(),
        tone: issue.tone,
        title: storyTitle(r),
        body: `${r.display_name} · ${issue.label.toLowerCase()}.`,
        meta:
          r.case_age_days != null
            ? `${r.case_age_days}d on file`
            : workspaceLabel(r.current_stage_code),
        href: matterHref(r.current_stage_code, r.client_matter_id),
      });
    }

    if (cards.length < 3 && approvals[0]) {
      const a = approvals[0];
      cards.push({
        key: `appr-${a.client_matter_id}`,
        category: "APPROVAL",
        tone: "crit",
        title: a.kind === "level" ? "Level approval" : "L3 demand approval",
        body: `${a.display_name} · waiting on owner sign-off.`,
        meta: "Open queue",
        href: "/owner/approvals",
      });
    }

    return cards.slice(0, 3);
  }, [attentionRows, approvals]);

  function applyFilter(key: string) {
    setShowCleared(false);
    setFilter(key);
    router.replace(key === "all" ? "/owner" : `/owner?flag=${key}`, {
      scroll: false,
    });
  }

  const primaryCta =
    tiles.solSoon > 0
      ? { href: "/owner/sol", label: "Open SOL Watch" }
      : tiles.pendingApprovals > 0
        ? { href: "/owner/approvals", label: "Open approvals" }
        : { href: "/cases", label: "Browse cases" };

  return (
    <div className="space-y-8">
      {/* Greeting header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-tight text-ink">
            {greetingHour()}, {firstName}.
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            {todayLabel()}
            <span className="mx-1.5 text-grid">·</span>
            <span className="font-medium text-ink">
              {needCount} item{needCount === 1 ? "" : "s"} need attention
            </span>
            <span className="text-muted"> — firm-wide, not your personal caseload</span>
          </p>
        </div>
        <Link
          href={primaryCta.href}
          className="inline-flex items-center gap-1.5 rounded-xl bg-accent-dk px-4 py-2.5 text-sm font-semibold text-white no-underline shadow-soft transition hover:opacity-95"
        >
          {primaryCta.label}
        </Link>
      </div>

      {/* Needs attention — story cards */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink">Needs attention</h2>
          <div className="inline-flex rounded-xl border border-grid bg-surface p-0.5 shadow-soft">
            <button
              type="button"
              onClick={() => {
                setShowCleared(false);
                applyFilter("all");
              }}
              className={`rounded-[10px] px-3 py-1.5 text-xs font-semibold transition ${
                !showCleared
                  ? "bg-accent-dk text-white"
                  : "text-muted hover:text-ink"
              }`}
            >
              Flagged
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCleared(true);
                setFilter("all");
              }}
              className={`rounded-[10px] px-3 py-1.5 text-xs font-semibold transition ${
                showCleared
                  ? "bg-accent-dk text-white"
                  : "text-muted hover:text-ink"
              }`}
            >
              Cleared ({clearedRows.length})
            </button>
          </div>
        </div>

        {storyCards.length === 0 ? (
          <div className="rounded-2xl border border-grid/70 bg-surface px-5 py-8 text-center text-sm text-muted shadow-soft">
            Nothing urgent in the firm queue right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {storyCards.map((card) => (
              <article
                key={card.key}
                className="flex flex-col rounded-2xl border border-grid/60 bg-surface p-5 shadow-soft"
              >
                <div
                  className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] ${
                    card.tone === "crit"
                      ? "text-danger"
                      : card.tone === "warn"
                        ? "text-warning"
                        : "text-accent-dk"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${toneDot(card.tone)}`}
                  />
                  {card.category}
                </div>
                <h3 className="mt-3 text-base font-semibold leading-snug text-ink">
                  {card.title}
                </h3>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">
                  {card.body}
                </p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-xs text-muted">{card.meta}</span>
                  <Link
                    href={card.href}
                    className="text-sm font-semibold text-accent-dk no-underline hover:underline"
                  >
                    Open →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Main + right rail */}
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                {showCleared ? "Quiet matters" : "Attention queue"}
              </h2>
              <p className="text-sm text-muted">
                Organized by next required action · showing {rows.length}
                {!showCleared ? ` of ${attentionRows.length}` : ""}
              </p>
            </div>
          </div>

          {!showCleared && (
            <div className="flex flex-wrap gap-1.5">
              {OWNER_FLAG_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => applyFilter(f.key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    filter === f.key
                      ? "bg-ink text-page shadow-soft"
                      : "bg-surface text-muted shadow-soft ring-1 ring-grid/80 hover:text-ink"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2.5">
            {rows.length === 0 ? (
              <div className="rounded-2xl border border-grid/60 bg-surface px-5 py-14 text-center text-sm text-muted shadow-soft">
                {showCleared ? (
                  "No quiet matters in this view."
                ) : (
                  <>
                    No firm-wide items require attention.{" "}
                    <Link
                      href="/cases"
                      className="font-semibold text-accent-dk no-underline hover:underline"
                    >
                      Browse active cases
                    </Link>
                  </>
                )}
              </div>
            ) : (
              rows.map((r) => {
                const issue = primaryIssue(r);
                const flags = flagList(r);
                const badge = statusBadge(r, issue, showCleared);
                const progress = stageProgress(r.current_stage_code);
                const href = matterHref(
                  r.current_stage_code,
                  r.client_matter_id,
                );
                return (
                  <article
                    key={r.client_matter_id}
                    className="grid grid-cols-1 items-center gap-4 rounded-2xl border border-grid/60 bg-surface px-5 py-4 shadow-soft transition hover:border-accent/30 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.85fr)_minmax(0,1fr)_auto]"
                  >
                    <div className="min-w-0">
                      <Link
                        href={href}
                        className="font-semibold text-accent-dk no-underline hover:underline"
                      >
                        {r.display_name}
                      </Link>
                      {r.tbi_indicated && (
                        <span className="ml-2 inline-flex rounded-md bg-danger-bg px-1.5 py-0.5 text-[10px] font-bold text-danger">
                          TBI
                        </span>
                      )}
                      <div className="mt-1 text-xs text-muted">
                        {STAGE_LABEL[r.current_stage_code] ??
                          r.current_stage_code}
                        {r.approved_level != null
                          ? ` · L${r.approved_level}`
                          : " · Level —"}
                        {flags.length > 1
                          ? ` · +${flags.length - 1} flags`
                          : ""}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink">
                        {workspaceLabel(r.current_stage_code)}
                      </div>
                      <div className="mt-2 h-1.5 w-full max-w-[140px] overflow-hidden rounded-full bg-grid/70">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-lt text-[11px] font-bold text-accent-dk">
                        {initials(r.case_manager)}
                      </span>
                      <span className="truncate text-sm text-ink">
                        {r.case_manager ?? (
                          <span className="font-semibold text-danger">
                            Unassigned
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-ink">
                        {r.case_age_days != null
                          ? `${r.case_age_days}d`
                          : "—"}
                      </div>
                      <Link
                        href={href}
                        className="mt-0.5 block truncate text-xs text-muted no-underline hover:text-accent-dk"
                      >
                        {nextAction(r)}
                      </Link>
                    </div>

                    <div className="sm:justify-self-end">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${badgeClass(badge.tone)}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          {overrides.length > 0 && (
            <section className="rounded-2xl border border-grid/60 bg-surface p-5 shadow-soft">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                Checklist overrides — last 90 days
              </h2>
              <ul className="mt-3 space-y-3 text-sm">
                {overrides.slice(0, 5).map((o, i) => (
                  <li
                    key={`${o.staff}-${o.title}-${i}`}
                    className="flex gap-3 border-t border-grid/70 pt-3 first:border-0 first:pt-0"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-lt text-[11px] font-bold text-accent-dk">
                      {initials(o.staff)}
                    </span>
                    <div>
                      <div className="font-semibold">{o.staff}</div>
                      <div className="text-muted">
                        {o.title}
                        {" · "}
                        {o.overrides_90d}×
                        {o.most_recent
                          ? ` · last ${formatDate(o.most_recent)}`
                          : ""}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Right rail */}
        <aside className="w-full shrink-0 space-y-4 xl:w-[300px]">
          <section className="rounded-2xl border border-grid/60 bg-surface p-5 shadow-soft">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">Approvals</h2>
              <span className="text-xs text-muted">
                {approvals.length} open
                {tiles.pendingApprovals > 0 ? " · waiting" : ""}
              </span>
            </div>
            {approvals.length === 0 ? (
              <p className="mt-4 text-sm text-muted">Nothing waiting on you.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {approvals.slice(0, 5).map((a) => (
                  <li
                    key={`${a.kind}-${a.client_matter_id}`}
                    className="flex items-start gap-3"
                  >
                    <span className="mt-1.5 h-4 w-4 shrink-0 rounded border border-grid" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink">
                        {a.display_name}
                      </div>
                      <div className="text-xs text-muted">
                        {a.kind === "level"
                          ? `Level · recommended L${a.recommended_level}`
                          : "L3 demand"}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-md bg-danger-bg px-1.5 py-0.5 text-[10px] font-bold text-danger">
                      Today
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/owner/approvals"
              className="mt-4 inline-block text-sm font-semibold text-accent-dk no-underline hover:underline"
            >
              Open approvals →
            </Link>
          </section>

          <section className="rounded-2xl border border-grid/60 bg-surface p-5 shadow-soft">
            <h2 className="text-sm font-semibold text-ink">Firm pulse</h2>
            <p className="mt-0.5 text-xs text-muted">Live queue health</p>
            <dl className="mt-4 space-y-3 text-sm">
              <HealthRow label="Active in queue" value={tiles.active} />
              <HealthRow
                label="Filing deadline soon"
                value={tiles.solSoon}
                hot={tiles.solSoon > 0}
              />
              <HealthRow
                label="SOL mismatches"
                value={tiles.solMismatches}
                hot={tiles.solMismatches > 0}
                href="/owner/sol"
              />
              <HealthRow
                label="Missing Level"
                value={tiles.missingLevel}
                hot={tiles.missingLevel > 0}
              />
              <HealthRow
                label="7-day review overdue"
                value={tiles.viability}
                hot={tiles.viability > 0}
              />
              <HealthRow
                label="Unassigned CM"
                value={unassignedCount}
                hot={unassignedCount > 0}
              />
            </dl>
            <Link
              href="/owner/sol"
              className="mt-4 inline-block text-sm font-semibold text-accent-dk no-underline hover:underline"
            >
              Open SOL Watch →
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}

function HealthRow({
  label,
  value,
  hot,
  href,
}: {
  label: string;
  value: number;
  hot?: boolean;
  href?: string;
}) {
  const inner = (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd
        className={`text-base font-semibold tabular-nums ${hot && value > 0 ? "text-danger" : "text-ink"}`}
      >
        {value}
      </dd>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block no-underline">
        {inner}
      </Link>
    );
  }
  return inner;
}
