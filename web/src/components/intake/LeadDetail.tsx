"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatDate, formatDateTime } from "@/lib/dates";
import {
  convertLeadToMatterAction,
  logAttemptAction,
  sendNelAction,
  updateLeadStatusAction,
} from "@/lib/intake/actions";
import { caseTypeLabel } from "@/lib/intake/case-types";
import { gateFromLead } from "@/lib/intake/gate";
import { leadDisplayName } from "@/lib/intake/display";
import { estimateSolPreview } from "@/lib/intake/sol";
import { LEAD_STATUS_META, type LeadRow } from "@/lib/intake/types";
import { CopyContact } from "@/components/ui/CopyContact";
import { LeadTemperatureSelect } from "./LeadTemperatureSelect";

type Attempt = {
  communication_log_id: string;
  channel: string;
  direction: string;
  summary: string | null;
  occurred_at: string;
};

export function LeadDetail({
  lead,
  phone,
  email,
  attempts,
}: {
  lead: LeadRow;
  phone: string | null;
  email: string | null;
  attempts: Attempt[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [attemptText, setAttemptText] = useState("");

  const inPerson = /in-person signing/i.test(lead.description ?? "");
  const gate = gateFromLead(lead, { phone, email, inPerson });
  const meta = LEAD_STATUS_META[lead.status];
  const sol = estimateSolPreview(lead.incident_date);
  const nelDue =
    lead.status === "rejected" && !lead.non_engagement_letter_sent_date;

  function run(
    fn: () => Promise<{
      ok: boolean;
      error?: string;
      message?: string;
      id?: string;
    }>,
    opts?: { goToMatter?: boolean },
  ) {
    setMsg(null);
    setErr(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setErr(res.error ?? "Failed");
      else {
        setMsg(res.message ?? "Done");
        if (opts?.goToMatter && res.id) {
          router.push(`/cases/${res.id}`);
          router.refresh();
          return;
        }
      }
      router.refresh();
    });
  }

  return (
    <div>
      <Link
        href="/intake"
        className="mb-3 inline-block text-sm text-accent-dk no-underline hover:underline"
      >
        ← Back to queue
      </Link>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <section className="rounded-panel border border-grid bg-surface p-5 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold">{leadDisplayName(lead)}</h1>
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${meta.chip}`}
                >
                  {meta.icon} {meta.label}
                </span>
              </div>
              <LeadTemperatureSelect
                leadId={lead.intake_lead_id}
                value={lead.lead_temperature}
              />
            </div>
            <dl className="mt-4 grid grid-cols-[130px_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted">Incident</dt>
              <dd>
                {caseTypeLabel(lead.case_type_code)} —{" "}
                {formatDate(lead.incident_date)}
              </dd>
              <dt className="text-muted">Location</dt>
              <dd>
                {(lead.description ?? "")
                  .split("\n")
                  .filter((l) => !l.startsWith("[in-person"))
                  .join(" ") || "—"}
              </dd>
              <dt className="text-muted">Phone</dt>
              <dd>
                {phone || lead.raw_phone ? (
                  <CopyContact
                    value={(phone ?? lead.raw_phone)!}
                    kind="phone"
                  />
                ) : (
                  "—"
                )}
              </dd>
              <dt className="text-muted">Email</dt>
              <dd>
                {email || lead.raw_email ? (
                  <CopyContact
                    value={(email ?? lead.raw_email)!}
                    kind="email"
                  />
                ) : inPerson ? (
                  "waived (in-person)"
                ) : (
                  "—"
                )}
              </dd>
              <dt className="text-muted">Est. SOL</dt>
              <dd>
                {sol ? (
                  <span>
                    {formatDate(sol.solDate)}{" "}
                    <span className="text-xs font-bold uppercase text-danger">
                      ATTORNEY-VERIFY
                    </span>
                  </span>
                ) : (
                  "—"
                )}
              </dd>
              {lead.resulting_matter_id && (
                <>
                  <dt className="text-muted">Matter</dt>
                  <dd className="font-mono text-xs">{lead.resulting_matter_id}</dd>
                </>
              )}
            </dl>

            {nelDue && (
              <div className="mt-4 rounded-lg border border-danger/40 bg-danger-bg px-3 py-2 text-sm font-semibold text-danger">
                🛑 Non-engagement letter not yet sent — malpractice control
              </div>
            )}
          </section>

          <section className="rounded-panel border border-grid bg-surface p-5 shadow-soft">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted">
              Sign-up gate — six minimums
            </h2>
            <ul className="mt-3 space-y-2">
              {gate.items.map((g) => (
                <li key={g.key} className="flex items-start gap-2 text-sm">
                  <span
                    className={`mt-0.5 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      g.ok
                        ? "bg-success-bg text-success"
                        : "bg-danger-bg text-danger"
                    }`}
                  >
                    {g.ok ? "✓" : "✕"}
                  </span>
                  <span>
                    <strong>{g.label}</strong>
                    <span className="text-muted"> — {g.value}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div
              className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${
                gate.ready
                  ? "bg-success-bg text-success"
                  : "bg-danger-bg text-danger"
              }`}
            >
              {gate.ready
                ? "✔ Gate satisfied — matter can open at signature"
                : `✕ ${gate.missing.length} of 6 outstanding`}
            </div>
          </section>

          <section className="rounded-panel border border-grid bg-surface p-5 shadow-soft">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted">
              Contact attempts
            </h2>
            <ul className="mt-3 space-y-3 border-l-2 border-grid pl-4">
              {attempts.length === 0 ? (
                <li className="text-sm text-muted">No attempts yet</li>
              ) : (
                attempts.map((a, i) => (
                  <li key={a.communication_log_id} className="relative text-sm">
                    <span
                      className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ${
                        i === 0 ? "bg-accent" : "bg-grid"
                      }`}
                    />
                    <div className="text-xs text-muted">
                      {formatDateTime(a.occurred_at)} · {a.channel}
                    </div>
                    <div>{a.summary}</div>
                  </li>
                ))
              )}
            </ul>
            <div className="mt-4 flex gap-2">
              <input
                value={attemptText}
                onChange={(e) => setAttemptText(e.target.value)}
                placeholder="What happened on this call…"
                className="h-10 flex-1 rounded-lg border border-grid bg-page px-3 text-sm"
              />
              <button
                type="button"
                disabled={pending || !attemptText.trim()}
                onClick={() =>
                  run(() => logAttemptAction(lead.intake_lead_id, attemptText))
                }
                className="rounded-lg border border-grid px-3 text-sm font-semibold hover:bg-surface-2 disabled:opacity-50"
              >
                Log attempt
              </button>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-panel border border-grid bg-surface p-5 shadow-soft">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted">
              Actions
            </h2>
            <div className="mt-3 flex flex-col gap-2">
              {lead.status === "open" && (
                <button
                  type="button"
                  disabled={pending || !gate.ready}
                  onClick={() =>
                    run(() =>
                      updateLeadStatusAction(lead.intake_lead_id, "contract_sent"),
                    )
                  }
                  className="rounded-lg bg-accent-dk px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  Mark contract sent
                </button>
              )}
              {(lead.status === "open" || lead.status === "contract_sent") && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      updateLeadStatusAction(lead.intake_lead_id, "signed"),
                    )
                  }
                  className="rounded-lg border border-grid px-3 py-2 text-sm font-semibold hover:bg-surface-2 disabled:opacity-50"
                >
                  Mark contract signed
                </button>
              )}
              {lead.status === "signed" && !lead.resulting_matter_id && (
                  <button
                    type="button"
                    disabled={pending || !gate.ready}
                    onClick={() =>
                      run(
                        () =>
                          convertLeadToMatterAction(lead.intake_lead_id, {
                            in_person_signing: inPerson,
                          }),
                        { goToMatter: true },
                      )
                    }
                    className="rounded-lg bg-success px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    Open matter
                  </button>
                )}
              {lead.status !== "rejected" && lead.status !== "signed" && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      updateLeadStatusAction(lead.intake_lead_id, "rejected", {
                        rejected_reason: "Rejected at intake",
                      }),
                    )
                  }
                  className="rounded-lg border border-danger px-3 py-2 text-sm font-semibold text-danger disabled:opacity-50"
                >
                  Reject lead
                </button>
              )}
              {nelDue && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => sendNelAction(lead.intake_lead_id))}
                  className="rounded-lg bg-danger px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  Record non-engagement letter sent
                </button>
              )}
            </div>
            {msg && (
              <p className="mt-3 text-sm font-semibold text-success">{msg}</p>
            )}
            {err && <p className="mt-3 text-sm font-semibold text-danger">{err}</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}
