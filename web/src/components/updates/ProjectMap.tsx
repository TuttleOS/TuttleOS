"use client";

import Link from "next/link";
import { useState } from "react";

type BuildStatus = "live" | "mvp" | "skeleton" | "locked";

const WORKSPACES: {
  role: string;
  roleCode: string;
  home: string;
  href: string;
  holders: string;
  caseload: string;
  status: BuildStatus;
  job: string;
  sections: { label: string; href?: string; note?: string }[];
  interacts: string[];
}[] = [
  {
    role: "Intake",
    roleCode: "intake",
    home: "/intake",
    href: "/intake",
    holders: "Rotating desk (Michael / Daniel / assigned CM)",
    caseload: "Leads world — not a CM caseload",
    status: "live",
    job: "Phone call → signed, correctly structured case (six-minimums gate, contract variant EN/ES).",
    sections: [
      { label: "Lead queue", href: "/intake" },
      { label: "New lead", href: "/intake/new" },
      { label: "My activity", href: "/intake/activity" },
      { label: "Contract package" },
    ],
    interacts: [
      "Hands signed matters to Case Manager (rotation / language)",
      "Escalates WD, minors, Level 3, crash conflicts → Attorney",
    ],
  },
  {
    role: "Case Manager",
    roleCode: "case_manager",
    home: "/cases",
    href: "/cases",
    holders: "Mark Garza · Christina Calderon · Emily Schuler (0.5)",
    caseload: "Assigned only (staff_assignment as CM)",
    status: "mvp",
    job: "Signature → demand-ready package; stays on through Kate, negotiation, and dual-track lit. Primary client relationship.",
    sections: [
      { label: "My caseload + Needs attention", href: "/cases" },
      { label: "New cases", href: "/cases/new-cases" },
      { label: "LORs / Liability / PD / Records queues" },
      { label: "Provider calls · My tasks" },
      { label: "Matter detail (full CM cards)" },
      { label: "Financials", note: "Locked" },
      { label: "Lit via switcher", note: "Milestones only" },
    ],
    interacts: [
      "Packages demand-ready file → Demand Writer (14-day clock)",
      "Dual-track with Lit PL; attorney breaks ties",
      "Level 3 / TBI / treatment gaps / LOP → Attorney",
      "Settlement funded → Liens",
    ],
  },
  {
    role: "Demand Writer",
    roleCode: "demand_writer",
    home: "/demands",
    href: "/demands",
    holders: "Kate",
    caseload: "Package-driven (not a caseload list)",
    status: "skeleton",
    job: "Turn demand-ready package into the firm’s demand. Flag blockers back to CM — never draft around holes.",
    sections: [
      { label: "Demands queue", href: "/demands", note: "Skeleton" },
      { label: "Matter", note: "Read-only (?mode=readonly)" },
    ],
    interacts: [
      "Receives package from CM",
      "Blockers → back to CM",
      "Level 3 send / escalated counters → Attorney",
      "Co-authors file-suit memo with CM",
    ],
  },
  {
    role: "Litigation Paralegal",
    roleCode: "litigation_paralegal",
    home: "/litigation",
    href: "/litigation",
    holders: "Two litigation paralegals",
    caseload: "Assigned only (as lit PL)",
    status: "mvp",
    job: "Run the lawsuit so nothing that can be lost is lost — filing, service, answers, discovery, DCO → trial.",
    sections: [
      { label: "My cases + Needs attention", href: "/litigation" },
      { label: "My tasks · Deadline horizon" },
      { label: "Lit matter (full tools)" },
      { label: "CM via switcher", note: "Full CM workspace" },
    ],
    interacts: [
      "Dual-track with CM while client still treating",
      "Filing concerns / defaults / experts / motions → Attorney",
      "After funding → Liens for money side",
    ],
  },
  {
    role: "Liens / Disbursement",
    roleCode: "lien_disbursement",
    home: "/liens",
    href: "/liens",
    holders: "Emily Schuler (0.5)",
    caseload: "Firm-wide settled cases (finance tier)",
    status: "skeleton",
    job: "Settled case → money correctly distributed. Finance detail is her tier and the attorney’s only.",
    sections: [
      { label: "Liens home", href: "/liens", note: "Skeleton + finance banner" },
      { label: "Matter", note: "Read-only until finance UI" },
    ],
    interacts: [
      "Picks up when settlement funds",
      "Coordinates UM/UIM sequencing with CM / Kate",
      "Trust / IOLTA questions still open with Michael",
    ],
  },
  {
    role: "Attorney / Owner",
    roleCode: "attorney",
    home: "/owner",
    href: "/owner",
    holders: "Michael Tuttle (+ Daniel on † items)",
    caseload: "Firm-wide",
    status: "live",
    job: "Own every decision the system refuses to automate — Level, SOL verify, conflicts, suit auth, petition sign.",
    sections: [
      { label: "Owner dashboard", href: "/owner" },
      { label: "Approvals · SOL · Calendar" },
      { label: "All workspaces (firm-wide nav)" },
      { label: "Role roster preview", note: "Header → preview any role" },
      { label: "Walkthrough /test" },
    ],
    interacts: [
      "Receives escalations from every station",
      "Can preview CM / Lit / Intake / etc. (audit stays attorney)",
      "File-suit authorization fires lit assignment",
    ],
  },
];

const ACCESS_MATRIX: {
  section: string;
  cells: string[];
}[] = [
  {
    section: "Intake leads",
    cells: ["✓", "—", "—", "—", "—", "✓"],
  },
  {
    section: "CM caseload / queues / matter",
    cells: ["🔒", "✓", "✓ switch", "RO", "RO", "✓"],
  },
  {
    section: "CM Financials",
    cells: ["🔒", "🔒", "🔒", "—", "† data", "✓"],
  },
  {
    section: "Lit cases / tools",
    cells: ["🔒", "◐ miles", "✓", "RO", "RO", "✓"],
  },
  {
    section: "Demands / Liens homes",
    cells: ["—", "—", "—", "skel", "skel", "✓"],
  },
  {
    section: "Owner / Approvals / SOL",
    cells: ["—", "—", "—", "—", "—", "✓"],
  },
];

const MATRIX_COLS = ["Intake", "CM", "Lit", "Demand", "Liens", "Atty"];

const HANDOFFS: { from: string; to: string; when: string; build: string }[] = [
  {
    from: "Intake",
    to: "Case Manager",
    when: "Contract signed → matter opens on CM rotation",
    build: "Live",
  },
  {
    from: "Intake",
    to: "Attorney",
    when: "WD / minor structure, Level 3 pattern, crash conflicts",
    build: "Live escalate",
  },
  {
    from: "Case Manager",
    to: "Demand Writer",
    when: "Demand-ready package — starts Kate’s 14-day clock",
    build: "/demands skeleton; matter RO",
  },
  {
    from: "Demand Writer",
    to: "Case Manager",
    when: "Package blockers — flag back, do not draft around",
    build: "UI still thin",
  },
  {
    from: "Demand Writer",
    to: "Attorney",
    when: "Level 3 demand approval before send; escalated counters",
    build: "† approval flags",
  },
  {
    from: "Case Manager",
    to: "Litigation PL",
    when: "File-suit / dual-track — medical track stays with CM",
    build: "Switcher live",
  },
  {
    from: "Litigation PL",
    to: "Case Manager",
    when: "Needs full CM tools (calls, PD, records) via switcher",
    build: "Full CM; audit under PL name",
  },
  {
    from: "Litigation PL",
    to: "Attorney",
    when: "Filing concern, default go/no-go, retained experts, motions",
    build: "Live lit tools",
  },
  {
    from: "CM or Lit (settled)",
    to: "Liens / Emily",
    when: "Settlement funded → disbursement & lien payoffs",
    build: "Finance UI blocked",
  },
  {
    from: "Attorney",
    to: "Any role",
    when: "Header role roster → preview that workspace",
    build: "Audit stays attorney",
  },
];

const BUILD_STAGES: {
  stage: string;
  title: string;
  status: "done" | "partial" | "open";
  items: string[];
}[] = [
  {
    stage: "0",
    title: "Foundation",
    status: "partial",
    items: [
      "Done: demo logins per role + attorney role preview",
      "Open: full consolidation vs earlier round feedback",
    ],
  },
  {
    stage: "1",
    title: "Data integrity",
    status: "partial",
    items: [
      "Done: PD edit/remove · negotiation directionality · coverage “No treatment”",
      "Open: PD duplicate-vehicle block · photo↔vehicle tagging",
    ],
  },
  {
    stage: "2",
    title: "Role dashboards",
    status: "done",
    items: [
      "Done (MVP): CM + Lit Needs attention + work queues (preview)",
    ],
  },
  {
    stage: "3",
    title: "CM beta rollout",
    status: "open",
    items: ["Ship CM workspace to real CMs; decide lit stagger"],
  },
  {
    stage: "4–5",
    title: "Settlements · Lit rollout",
    status: "open",
    items: ["Settlement checklist · liens finance UI · lit module after CM beta"],
  },
  {
    stage: "6",
    title: "Migration",
    status: "open",
    items: ["Last — only after schema stable; dry run then live"],
  },
];

const MATTER_CARDS = [
  "Contact / badges",
  "Checklist",
  "Treatment · Coverage boxes",
  "Property damage (+ photos)",
  "Records & bills",
  "Demand & negotiation",
  "Case documents",
  "Insurance & claims",
  "Notes · Tasks",
];

function statusChip(status: BuildStatus) {
  switch (status) {
    case "live":
      return { label: "Live", className: "bg-success/15 text-success" };
    case "mvp":
      return { label: "MVP preview", className: "bg-accent/15 text-accent-dk" };
    case "skeleton":
      return { label: "Skeleton", className: "bg-warning/15 text-warning" };
    case "locked":
      return { label: "Locked", className: "bg-page text-muted" };
  }
}

function stageChip(status: "done" | "partial" | "open") {
  switch (status) {
    case "done":
      return { label: "Done", className: "bg-success/15 text-success" };
    case "partial":
      return { label: "Partial", className: "bg-accent/15 text-accent-dk" };
    case "open":
      return { label: "Open", className: "bg-warning/15 text-warning" };
  }
}

function FlowStrip() {
  const steps: { label: string; sub: string; tip: string }[] = [
    { label: "Intake", sub: "Lead → contract", tip: "Signed matter" },
    { label: "Case Manager", sub: "Treat · PD · records", tip: "Demand-ready" },
    { label: "Demand", sub: "Kate · 14 days", tip: "Send / negotiate" },
    { label: "Litigation", sub: "File · serve · disc.", tip: "Dual-track w/ CM" },
    { label: "Liens / $", sub: "Funded settlement", tip: "Disburse" },
  ];

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px] space-y-4">
        <div className="flex justify-center">
          <div className="rounded-lg border-2 border-accent bg-surface px-5 py-3 text-center">
            <div className="text-sm font-bold text-ink">Attorney / Owner</div>
            <div className="mt-0.5 max-w-md text-[11px] text-muted">
              Level approvals · ATTORNEY-VERIFY SOL · conflicts · suit auth ·
              petition sign · escalated counters · role preview
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
          <span className="h-px w-8 bg-grid" aria-hidden />
          escalations from every station
          <span className="h-px w-8 bg-grid" aria-hidden />
        </div>
        <div className="flex items-stretch gap-1">
          {steps.map((s, i) => (
            <div key={s.label} className="flex min-w-0 flex-1 items-center gap-1">
              <div className="w-full rounded-lg border border-grid bg-page px-2 py-2.5 text-center">
                <div className="text-xs font-bold text-ink">{s.label}</div>
                <div className="mt-0.5 text-[10px] text-muted">{s.sub}</div>
                <div className="mt-1 text-[10px] font-semibold text-accent-dk">
                  {s.tip}
                </div>
              </div>
              {i < steps.length - 1 ? (
                <span className="shrink-0 self-center text-sm text-muted" aria-hidden>
                  →
                </span>
              ) : null}
            </div>
          ))}
        </div>
        <ul className="grid gap-1.5 text-[11px] text-muted sm:grid-cols-2">
          <li>
            <span className="font-semibold text-ink">Demand → CM:</span> blockers
            flagged back (dashed return)
          </li>
          <li>
            <span className="font-semibold text-ink">CM ↔ Lit:</span> dual-track
            until settlement; switcher depth differs
          </li>
          <li>
            <span className="font-semibold text-ink">CM / Lit → Liens:</span> only
            after funding confirms
          </li>
          <li>
            <span className="font-semibold text-ink">Gate:</span> Postgres RLS —
            UI locks are hints only
          </li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Project map for Version updates — keep aligned with
 * docs/PROJECT_SECTIONS_BY_ROLE.md + ROLES_AND_PERMISSIONS.md.
 */
export function ProjectMap() {
  const [openRole, setOpenRole] = useState<string | null>("case_manager");

  return (
    <section
      id="project-map"
      className="scroll-mt-6 rounded-panel border border-grid bg-surface p-5 shadow-soft"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">Project map</h2>
          <p className="mt-1 text-sm text-muted">
            Where each profile lives, what they can open, and how work hands
            off. Expand a role for sections and interactions.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-success/15 px-2.5 py-1 text-[10px] font-bold text-success">
            Live
          </span>
          <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-bold text-accent-dk">
            MVP preview
          </span>
          <span className="rounded-full bg-warning/15 px-2.5 py-1 text-[10px] font-bold text-warning">
            Skeleton
          </span>
          <span className="rounded-full bg-page px-2.5 py-1 text-[10px] font-semibold text-muted">
            Jul 2026
          </span>
        </div>
      </div>

      {/* Case path */}
      <div className="mt-5 rounded-lg border border-grid bg-page/50 px-4 py-4">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted">
          1. Case path
        </h3>
        <div className="mt-3">
          <FlowStrip />
        </div>
      </div>

      {/* Workspaces */}
      <div className="mt-6">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted">
          2. Workspaces by profile
        </h3>
        <ul className="mt-3 space-y-2">
          {WORKSPACES.map((w) => {
            const chip = statusChip(w.status);
            const open = openRole === w.roleCode;
            return (
              <li
                key={w.roleCode}
                className="overflow-hidden rounded-lg border border-grid bg-page"
              >
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left hover:bg-surface/80"
                  onClick={() =>
                    setOpenRole(open ? null : w.roleCode)
                  }
                  aria-expanded={open}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={w.href}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm font-bold text-accent-dk hover:underline"
                      >
                        {w.role}
                      </Link>
                      <code className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-muted">
                        {w.roleCode}
                      </code>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${chip.className}`}
                      >
                        {chip.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted">
                      Home{" "}
                      <span className="font-semibold text-ink">{w.home}</span>
                      {" · "}
                      {w.holders}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-muted">
                    {open ? "−" : "+"}
                  </span>
                </button>
                {open ? (
                  <div className="space-y-3 border-t border-grid px-3 py-3 text-xs">
                    <p className="text-muted">
                      <span className="font-semibold text-ink">Job: </span>
                      {w.job}
                    </p>
                    <p className="text-muted">
                      <span className="font-semibold text-ink">Caseload: </span>
                      {w.caseload}
                    </p>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                        Sections
                      </p>
                      <ul className="mt-1.5 flex flex-wrap gap-1.5">
                        {w.sections.map((s) => (
                          <li
                            key={s.label}
                            className="rounded-md border border-grid bg-surface px-2 py-1"
                          >
                            {s.href ? (
                              <Link
                                href={s.href}
                                className="font-semibold text-accent-dk hover:underline"
                              >
                                {s.label}
                              </Link>
                            ) : (
                              <span className="font-semibold text-ink">
                                {s.label}
                              </span>
                            )}
                            {s.note ? (
                              <span className="text-muted"> · {s.note}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                        Interacts with
                      </p>
                      <ul className="mt-1.5 list-disc space-y-1 pl-4 text-muted">
                        {w.interacts.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-[11px] text-muted">
          Also: <span className="font-semibold text-ink">admin</span> (Brett
          only, firm-wide like attorney) ·{" "}
          <span className="font-semibold text-ink">senior_paralegal</span>{" "}
          (Daniel — † flags for Level/conflicts) ·{" "}
          <span className="font-semibold text-ink">records_clerk</span>{" "}
          quarantined / unused.
        </p>
      </div>

      {/* Access matrix */}
      <div className="mt-6">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted">
          3. Who can open what
        </h3>
        <p className="mt-1 text-[11px] text-muted">
          ✓ full · ◐ limited · 🔒 locked · RO read-only · skel skeleton · —
          not in primary nav
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[11px]">
            <thead>
              <tr className="border-b border-grid text-muted">
                <th className="py-2 pr-2 font-semibold">Section</th>
                {MATRIX_COLS.map((c) => (
                  <th key={c} className="py-2 px-1 font-semibold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ACCESS_MATRIX.map((row) => (
                <tr key={row.section} className="border-b border-grid/70">
                  <td className="py-2 pr-2 font-semibold text-ink">
                    {row.section}
                  </td>
                  {row.cells.map((cell, i) => (
                    <td key={MATRIX_COLS[i]} className="px-1 py-2 text-muted">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 rounded-lg border border-grid bg-page/60 px-3 py-2.5 text-[11px] text-muted">
          <p className="font-bold uppercase tracking-wide text-muted">
            CM ↔ Lit switcher
          </p>
          <ul className="mt-1.5 space-y-1">
            <li>
              <span className="font-semibold text-ink">Lit PL → CM:</span> full
              Case Manager workspace (audit under paralegal)
            </li>
            <li>
              <span className="font-semibold text-ink">CM → Lit:</span>{" "}
              milestones only — Tasks / Deadlines stay locked
            </li>
            <li>
              <span className="font-semibold text-ink">Attorney / admin / senior PL:</span>{" "}
              both directions, full
            </li>
          </ul>
        </div>
      </div>

      {/* Shared matter */}
      <div className="mt-6">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted">
          4. Shared matter page
        </h3>
        <p className="mt-1 text-[11px] text-muted">
          Same cards for everyone who can open a case; write depth differs by
          role (Demand / Liens = read-only mutate deny).
        </p>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {MATTER_CARDS.map((c) => (
            <li
              key={c}
              className="rounded-md border border-grid bg-page px-2.5 py-1 text-[11px] font-semibold text-ink"
            >
              {c}
            </li>
          ))}
        </ul>
      </div>

      {/* Handoffs */}
      <div className="mt-6">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted">
          5. Handoffs & escalations
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[11px]">
            <thead>
              <tr className="border-b border-grid text-muted">
                <th className="py-2 pr-2 font-semibold">From</th>
                <th className="py-2 pr-2 font-semibold">To</th>
                <th className="py-2 pr-2 font-semibold">When</th>
                <th className="py-2 font-semibold">Build</th>
              </tr>
            </thead>
            <tbody>
              {HANDOFFS.map((h) => (
                <tr
                  key={`${h.from}-${h.to}-${h.when}`}
                  className="border-b border-grid/70 align-top"
                >
                  <td className="py-2 pr-2 font-semibold text-ink">{h.from}</td>
                  <td className="py-2 pr-2 text-ink">{h.to}</td>
                  <td className="py-2 pr-2 text-muted">{h.when}</td>
                  <td className="py-2 text-muted">{h.build}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Build pipeline */}
      <div className="mt-6">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted">
          6. Build priority (where we are)
        </h3>
        <ul className="mt-3 space-y-2">
          {BUILD_STAGES.map((s) => {
            const chip = stageChip(s.status);
            return (
              <li
                key={s.stage}
                className="rounded-lg border border-grid bg-page px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-ink">
                    Stage {s.stage} — {s.title}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${chip.className}`}
                  >
                    {chip.label}
                  </span>
                </div>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[11px] text-muted">
                  {s.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="mt-5 text-[11px] text-muted">
        Source of truth:{" "}
        <code className="rounded bg-page px-1 py-0.5 text-[10px]">
          docs/PROJECT_SECTIONS_BY_ROLE.md
        </code>
        ,{" "}
        <code className="rounded bg-page px-1 py-0.5 text-[10px]">
          docs/ROLES_AND_PERMISSIONS.md
        </code>
        ,{" "}
        <code className="rounded bg-page px-1 py-0.5 text-[10px]">
          docs/BUILD_PRIORITY_REVIEW_TODOS.md
        </code>
        . Demo logins:{" "}
        <code className="rounded bg-page px-1 py-0.5 text-[10px]">
          docs/ROLE_TEST_ACCOUNTS.md
        </code>
        .
      </p>
    </section>
  );
}
