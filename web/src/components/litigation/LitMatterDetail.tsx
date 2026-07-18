"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatDate } from "@/lib/dates";
import { DateField } from "@/components/ui/DateField";
import { CopyEmail } from "@/components/ui/CopyEmail";
import { caseTypeLabel } from "@/lib/intake/case-types";
import { STAGE_LABEL, type MatterDetail, type TaskRow, type TeamMember } from "@/lib/cases/types";
import type { CourtCaseRow } from "@/lib/litigation/types";
import {
  addLitNoteAction,
  completeLitTaskAction,
  createLitFollowUpAction,
  reopenLitTaskAction,
} from "@/lib/litigation/actions";
import { MatterViewToggle } from "@/components/shell/MatterViewToggle";
import { AssignCaseManagerSelect } from "@/components/cases/AssignCaseManagerSelect";
import { canSwitchCmLit } from "@/lib/workspace";
import type { StaffRoleCode } from "@/lib/staff";
import type { AssignableStaff } from "@/lib/cases/queries";

function canAssignCm(role?: StaffRoleCode | string, isAttorney?: boolean) {
  if (isAttorney) return true;
  return (
    role === "attorney" ||
    role === "admin" ||
    role === "senior_paralegal" ||
    role === "case_manager"
  );
}

export function LitMatterDetail({
  matter,
  team,
  phone,
  email,
  court,
  deadlines,
  tasks,
  notes,
  viewerRole,
  viewerIsAttorney = false,
  cmCandidates = [],
  milestonesOnly = false,
}: {
  matter: MatterDetail;
  team: TeamMember[];
  phone: string | null;
  email: string | null;
  court: CourtCaseRow | null;
  deadlines: {
    deadline_id: string;
    label: string;
    effective_date: string;
    jurisdictional: boolean;
    source: string;
    status: string;
    rule_code: string | null;
  }[];
  tasks: TaskRow[];
  notes: { note_id: string; body: string; pinned: boolean; created_at: string }[];
  viewerRole?: StaffRoleCode | string;
  viewerIsAttorney?: boolean;
  cmCandidates?: AssignableStaff[];
  milestonesOnly?: boolean;
}) {
  const router = useRouter();
  const [focus, setFocus] = useState(true);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [followTitle, setFollowTitle] = useState("");
  const [followDue, setFollowDue] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const cm = team.find((t) => t.assignment_role === "case_manager");
  const pl = team.find((t) => t.assignment_role === "litigation_paralegal");
  const openTasks = tasks.filter((t) =>
    ["open", "in_progress"].includes(t.status),
  );
  const today = new Date().toISOString().slice(0, 10);

  function isOpen(id: string, hot = false) {
    if (!focus) return true;
    if (open[id] != null) return open[id];
    return hot;
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setMsg(null);
    setErr(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setErr(res.error ?? "Failed");
      else setMsg(res.message ?? "Done");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/litigation"
          className="inline-block text-sm text-accent-dk no-underline hover:underline"
        >
          ← Back to cases
        </Link>
        {viewerRole && canSwitchCmLit(viewerRole) && (
          <MatterViewToggle
            matterId={matter.client_matter_id}
            active="litigation"
          />
        )}
      </div>

      {milestonesOnly && (
        <div className="rounded-panel border border-warning/40 bg-warning-bg px-4 py-3 text-sm">
          <p className="font-semibold">Milestones-only litigation view</p>
          <p className="text-xs text-muted">
            Case Managers see filing / deadline milestones here — not discovery
            work product. Writes still audit under your name.
          </p>
        </div>
      )}

      <section className="rounded-panel border border-grid bg-surface p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{matter.display_name}</h1>
            <div className="mt-1 flex flex-wrap gap-2 text-sm">
              <span className="rounded-md bg-info-bg px-2 py-0.5 text-xs font-semibold text-info">
                {STAGE_LABEL[matter.current_stage_code] ??
                  matter.current_stage_code}
              </span>
              {court?.cause_number && (
                <span className="text-muted">{court.cause_number}</span>
              )}
            </div>
            <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <div>
                <span className="text-muted">Type / DOI — </span>
                {caseTypeLabel(matter.incident?.case_type_code)} ·{" "}
                {formatDate(matter.incident?.date_of_loss)}
              </div>
              <div>
                <span className="text-muted">Court — </span>
                {court?.court_name ?? "—"}
                {court?.discovery_level != null
                  ? ` · L${court.discovery_level}`
                  : ""}
              </div>
              <div>
                <span className="text-muted">SOL — </span>
                {matter.sol_date ? (
                  <>
                    {formatDate(matter.sol_date)}{" "}
                    <span className="text-[10px] font-bold uppercase text-danger">
                      ATTORNEY-VERIFY
                    </span>
                  </>
                ) : (
                  "—"
                )}
              </div>
              <div>
                <span className="text-muted">Team — </span>
                CM:{" "}
                <AssignCaseManagerSelect
                  matterId={matter.client_matter_id}
                  currentStaffId={cm?.staff_id ?? null}
                  currentName={cm?.name}
                  options={cmCandidates}
                  canAssign={canAssignCm(viewerRole, viewerIsAttorney)}
                />{" "}
                · PL: {pl?.name ?? (
                  <span className="text-warning">UNASSIGNED</span>
                )}
              </div>
            </dl>
          </div>
          <button
            type="button"
            onClick={() => setFocus((f) => !f)}
            className="rounded-lg border border-grid px-3 py-2 text-sm font-semibold hover:bg-surface-2"
          >
            {focus ? "🗂 Full view" : "🎯 Focus view"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 border-t border-grid pt-3 text-sm">
          <div>
            <span className="text-muted">Phone — </span>
            {phone ? (
              <a href={`tel:${phone}`} className="text-accent-dk">
                {phone}
              </a>
            ) : (
              "—"
            )}
          </div>
          <div>
            <span className="text-muted">Email — </span>
            {email ? <CopyEmail email={email} /> : "—"}
          </div>
          <div>
            <span className="text-muted">Language — </span>
            {matter.person?.preferred_language === "es" ? "Spanish" : "English"}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <StatusChip
            label="Deadlines"
            ok={deadlines.length > 0}
            onClick={() => setOpen((s) => ({ ...s, "card-deadlines": true }))}
          />
          <StatusChip
            label="Tasks"
            ok={openTasks.length === 0}
            onClick={() => setOpen((s) => ({ ...s, "card-tasks": true }))}
          />
          <StatusChip
            label="Court"
            ok={!!court?.cause_number}
            onClick={() => setOpen((s) => ({ ...s, "card-court": true }))}
          />
        </div>
      </section>

      {msg && <p className="text-sm font-semibold text-success">{msg}</p>}
      {err && <p className="text-sm font-semibold text-danger">{err}</p>}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          {!milestonesOnly && (
          <Card
            title="Client called — create follow-up"
            open={isOpen("card-followup", true)}
            onToggle={() =>
              setOpen((s) => ({
                ...s,
                "card-followup": !isOpen("card-followup", true),
              }))
            }
          >
            <div className="flex flex-wrap gap-2">
              <input
                value={followTitle}
                onChange={(e) => setFollowTitle(e.target.value)}
                placeholder="What to do…"
                className="h-10 min-w-[200px] flex-1 rounded-lg border border-grid bg-page px-3 text-sm"
              />
              <DateField
                value={followDue}
                onChange={setFollowDue}
                className="h-10 w-[9.5rem] rounded-lg border border-grid bg-page px-3 text-sm"
              />
              <button
                type="button"
                disabled={pending || !followTitle.trim() || !followDue}
                onClick={() =>
                  run(() =>
                    createLitFollowUpAction({
                      client_matter_id: matter.client_matter_id,
                      title: followTitle,
                      due_date: followDue,
                    }),
                  )
                }
                className="rounded-lg bg-accent-dk px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </Card>
          )}

          <Card
            title={`Court case · ${court?.cause_number ?? "not filed"}`}
            open={isOpen("card-court", !court?.cause_number)}
            onToggle={() =>
              setOpen((s) => ({
                ...s,
                "card-court": !isOpen("card-court", !court?.cause_number),
              }))
            }
          >
            {!court ? (
              <p className="text-sm text-muted">No court case record yet.</p>
            ) : (
              <dl className="grid grid-cols-[120px_1fr] gap-y-1 text-sm">
                <dt className="text-muted">Court</dt>
                <dd>{court.court_name ?? "—"}</dd>
                <dt className="text-muted">Cause</dt>
                <dd>{court.cause_number ?? "—"}</dd>
                <dt className="text-muted">Filed</dt>
                <dd>{formatDate(court.filed_date)}</dd>
                <dt className="text-muted">Discovery</dt>
                <dd>
                  {court.discovery_level != null
                    ? `Level ${court.discovery_level}`
                    : "—"}
                  {court.jury_demanded ? " · jury" : ""}
                  {court.hb19_applies ? " · HB19" : ""}
                </dd>
                <dt className="text-muted">DCO</dt>
                <dd>{formatDate(court.dco_signed_date)}</dd>
              </dl>
            )}
          </Card>

          <Card
            title={`Deadlines · ${deadlines.length}`}
            open={isOpen(
              "card-deadlines",
              deadlines.some((d) => d.effective_date < today || d.jurisdictional),
            )}
            onToggle={() =>
              setOpen((s) => ({
                ...s,
                "card-deadlines": !isOpen("card-deadlines", true),
              }))
            }
          >
            {deadlines.length === 0 ? (
              <p className="text-sm text-muted">No pending deadlines.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {deadlines.map((d) => (
                  <li
                    key={d.deadline_id}
                    className={
                      d.effective_date < today
                        ? "rounded-md bg-danger-bg px-2 py-1 text-danger"
                        : ""
                    }
                  >
                    <span className="font-semibold">
                      {formatDate(d.effective_date)}
                    </span>
                    {" — "}
                    {d.label}
                    {d.jurisdictional && (
                      <span className="ml-2 text-[10px] font-bold">JX</span>
                    )}
                    {d.source === "court_order" && (
                      <span className="ml-2 text-[10px] font-bold text-info">
                        COURT ORDER
                      </span>
                    )}
                    <div className="text-xs text-muted">
                      {d.source}
                      {d.rule_code ? ` · ${d.rule_code}` : ""}
                      {d.rule_code && (
                        <span className="ml-1 font-bold uppercase text-danger">
                          ATTORNEY-VERIFY
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/litigation/deadlines"
              className="mt-3 inline-block text-sm font-semibold text-accent-dk no-underline hover:underline"
            >
              Open Deadline Horizon →
            </Link>
          </Card>

          <Card
            title={`Tasks · ${openTasks.length} open`}
            open={isOpen("card-tasks", openTasks.length > 0)}
            onToggle={() =>
              setOpen((s) => ({
                ...s,
                "card-tasks": !isOpen("card-tasks", openTasks.length > 0),
              }))
            }
          >
            {tasks.length === 0 ? (
              <p className="text-sm text-muted">No tasks yet.</p>
            ) : (
              <ul className="space-y-2">
                {tasks.map((t) => (
                  <li key={t.task_id} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={t.status === "done"}
                      disabled={pending || milestonesOnly}
                      onChange={() =>
                        run(() =>
                          t.status === "done"
                            ? reopenLitTaskAction(
                                t.task_id,
                                matter.client_matter_id,
                              )
                            : completeLitTaskAction(
                                t.task_id,
                                matter.client_matter_id,
                              ),
                        )
                      }
                    />
                    <div>
                      <div
                        className={
                          t.status === "done"
                            ? "text-muted line-through"
                            : "font-semibold"
                        }
                      >
                        {t.title}
                      </div>
                      <div className="text-xs text-muted">
                        {t.due_date ? formatDate(t.due_date) : "—"}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card
            title="Notes"
            open={isOpen("card-notes", notes.some((n) => n.pinned))}
            onToggle={() =>
              setOpen((s) => ({
                ...s,
                "card-notes": !isOpen("card-notes", false),
              }))
            }
          >
            <ul className="mb-3 space-y-2 text-sm">
              {notes.length === 0 && (
                <li className="text-muted">No notes yet.</li>
              )}
              {notes.map((n) => (
                <li key={n.note_id} className="border-l-2 border-grid pl-2">
                  {n.body}
                  <div className="text-xs text-muted">
                    {formatDate(n.created_at)}
                  </div>
                </li>
              ))}
            </ul>
            {!milestonesOnly && (
              <>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-grid bg-page px-3 py-2 text-sm"
                  placeholder="Add a note…"
                />
                <button
                  type="button"
                  disabled={pending || !note.trim()}
                  onClick={() =>
                    run(async () => {
                      const res = await addLitNoteAction(
                        matter.client_matter_id,
                        note,
                      );
                      if (res.ok) setNote("");
                      return res;
                    })
                  }
                  className="mt-2 rounded-lg border border-grid px-3 py-1.5 text-sm font-semibold hover:bg-surface-2 disabled:opacity-50"
                >
                  Save note
                </button>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-panel border border-grid bg-surface shadow-soft">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold"
      >
        <span>{title}</span>
        <span className="text-muted">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="border-t border-grid px-4 py-3">{children}</div>}
    </section>
  );
}

function StatusChip({
  label,
  ok,
  onClick,
}: {
  label: string;
  ok: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2 py-1 text-xs font-semibold ${
        ok ? "bg-success-bg text-success" : "bg-danger-bg text-danger"
      }`}
    >
      {ok ? "●" : "✕"} {label}
    </button>
  );
}
