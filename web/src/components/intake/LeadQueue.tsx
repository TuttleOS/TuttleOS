import Link from "next/link";
import { formatDate, formatDateTime } from "@/lib/dates";
import { caseTypeLabel } from "@/lib/intake/case-types";
import { estimateSolPreview } from "@/lib/intake/sol";
import {
  LEAD_STATUS_META,
  type LeadRow,
  type LeadStatus,
} from "@/lib/intake/types";
import { leadDisplayName } from "@/lib/intake/display";
import { gateFromLead } from "@/lib/intake/gate";
import { LeadTemperatureBadge } from "./LeadTemperatureBadge";

const FILTERS: { key: LeadStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open — working" },
  { key: "contract_sent", label: "Contract out" },
  { key: "signed", label: "Signed → matter" },
  { key: "rejected", label: "Rejected" },
  { key: "no_response", label: "No response" },
];

export function LeadQueue({
  leads,
  filter,
}: {
  leads: LeadRow[];
  filter: LeadStatus | "all";
}) {
  const counts = {
    active: leads.filter((l) =>
      ["open", "contract_sent"].includes(l.status),
    ).length,
    open: leads.filter((l) => l.status === "open").length,
    out: leads.filter((l) => l.status === "contract_sent").length,
    signed: leads.filter((l) => l.status === "signed").length,
    nel: leads.filter(
      (l) => l.status === "rejected" && !l.non_engagement_letter_sent_date,
    ).length,
  };

  const rows =
    filter === "all" ? leads : leads.filter((l) => l.status === filter);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-accent-dk">
            Intake workspace
          </p>
          <h1 className="text-2xl font-bold">Lead Queue</h1>
        </div>
        <Link
          href="/intake/new"
          className="rounded-lg bg-accent-dk px-4 py-2.5 text-sm font-bold text-white no-underline hover:brightness-105"
        >
          + New Lead
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Tile
          href="/intake?status=all"
          label="Active leads"
          value={counts.active}
          sub="open + contract out"
        />
        <Tile
          href="/intake?status=open"
          label="Awaiting next touch"
          value={counts.open}
          sub="call today"
          tone="warn"
        />
        <Tile
          href="/intake?status=contract_sent"
          label="Contracts out"
          value={counts.out}
          sub="chase signatures"
        />
        <Tile
          href="/intake?status=signed"
          label="Signed"
          value={counts.signed}
          sub="handed to CM path"
        />
        <Tile
          href="/intake?status=rejected"
          label="Non-engagement letters due"
          value={counts.nel}
          sub="malpractice control"
          tone="crit"
        />
      </div>

      <section className="overflow-hidden rounded-panel border border-grid bg-surface shadow-soft">
        <div className="flex flex-wrap gap-2 border-b border-grid px-4 py-3">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={f.key === "all" ? "/intake" : `/intake?status=${f.key}`}
              className={`rounded-full border px-3 py-1 text-xs no-underline ${
                filter === f.key
                  ? "border-ink bg-ink text-page"
                  : "border-grid bg-page text-muted hover:border-accent"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-grid text-xs text-muted">
                <th className="px-4 py-2 font-semibold">Lead</th>
                <th className="px-4 py-2 font-semibold">Incident date</th>
                <th className="px-4 py-2 font-semibold">Sign-up minimums</th>
                <th className="px-4 py-2 font-semibold">Source</th>
                <th className="px-4 py-2 font-semibold">Est. SOL</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 font-semibold">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-muted">
                    No leads in this status.
                  </td>
                </tr>
              ) : (
                rows.map((l) => {
                  const meta = LEAD_STATUS_META[l.status];
                  const gate = gateFromLead(l, {
                    phone: l.primary_phone ?? l.raw_phone,
                    email: l.primary_email ?? l.raw_email,
                    inPerson: /in-person signing/i.test(l.description ?? ""),
                  });
                  const sol = estimateSolPreview(l.incident_date);
                  return (
                    <tr
                      key={l.intake_lead_id}
                      className="border-b border-grid hover:bg-surface-2"
                    >
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/intake/leads/${l.intake_lead_id}`}
                            className="font-semibold text-accent-dk no-underline hover:underline"
                          >
                            {leadDisplayName(l)}
                          </Link>
                          <LeadTemperatureBadge value={l.lead_temperature} />
                        </div>
                        <div className="text-xs text-muted">
                          {caseTypeLabel(l.case_type_code)}
                          {l.person?.preferred_language === "es"
                            ? " · Spanish"
                            : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatDate(l.incident_date)}
                      </td>
                      <td className="px-4 py-3">
                        {gate.ready ? (
                          <span className="font-semibold text-success">
                            ✔ complete
                          </span>
                        ) : (
                          <span className="font-semibold text-danger">
                            ⚠ missing{" "}
                            {gate.missing.map((m) => m.label.toLowerCase()).join(", ")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {l.marketing_source ?? l.intake_source ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {sol ? (
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${
                              sol.urgency === "crit"
                                ? "bg-danger-bg text-danger"
                                : sol.urgency === "near"
                                  ? "bg-warning-bg text-warning"
                                  : "bg-surface-2 text-muted"
                            }`}
                            title="Estimated SOL — ATTORNEY-VERIFY"
                          >
                            {sol.days}d to SOL
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${meta.chip}`}
                        >
                          {meta.icon} {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {formatDateTime(l.updated_at)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Tile({
  href,
  label,
  value,
  sub,
  tone,
}: {
  href: string;
  label: string;
  value: number;
  sub: string;
  tone?: "warn" | "crit";
}) {
  return (
    <Link
      href={href}
      className={`rounded-panel border border-grid bg-surface p-4 no-underline shadow-soft hover:border-accent ${
        tone === "crit"
          ? "border-l-4 border-l-danger"
          : tone === "warn"
            ? "border-l-4 border-l-warning"
            : ""
      }`}
    >
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold text-ink">{value}</div>
      <div className="text-xs text-muted">{sub}</div>
    </Link>
  );
}
