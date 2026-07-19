"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatDate } from "@/lib/dates";
import { DateField } from "@/components/ui/DateField";
import { ExpandableNote } from "@/components/ui/ExpandableNote";
import { EditableContact, type ContactHistoryRow } from "@/components/ui/EditableContact";
import { ConfirmDeleteDialog } from "@/components/ui/ConfirmDeleteDialog";
import { softDeleteMatterAction } from "@/lib/contacts/actions";
import { caseTypeLabel } from "@/lib/intake/case-types";
import {
  addNoteAction,
  completeTaskAction,
  createFollowUpTaskAction,
  reopenTaskAction,
} from "@/lib/cases/actions";
import { STAGE_LABEL, type MatterDetail, type TaskRow, type TeamMember, type TreatmentEpisodeRow } from "@/lib/cases/types";
import { flagList, type StalledRow } from "@/lib/cases/types";
import {
  CoverageBoxesCard,
  DemandNegotiationCard,
  PropertyDamageCard,
  RecordsTrackingCard,
} from "@/components/cases/MatterDeepenCards";
import { DocumentsPanel } from "@/components/cases/DocumentsPanel";
import type {
  CoverageBoxState,
  DemandRow,
  NegotiationRow,
  PdClaimRow,
  ProviderDirectoryRow,
  RecordRequestRow,
} from "@/lib/cases/matterExtras";
import type { AccessLogRow, DocumentRow } from "@/lib/documents/types";
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

const JUMP: Record<string, string> = {
  checklist: "card-checklist",
  treatment: "card-treatment",
  coverage: "card-coverage",
  pd: "card-pd",
  records: "card-records",
  documents: "card-documents",
  demand: "card-demand",
  insurance: "card-insurance",
  notes: "card-notes",
  actions: "card-actions",
  companion: "card-companion",
  followup: "card-followup",
};

export function MatterDetailView({
  matter,
  team,
  phone,
  email,
  tasks,
  notes,
  episodes,
  claims,
  companions,
  stalled,
  viewerRole,
  pdClaims,
  coverageBoxes,
  recordRequests,
  demands,
  negotiations,
  providerDirectory,
  cmCandidates = [],
  viewerIsAttorney = false,
  phoneHistory = [],
  emailHistory = [],
  canSoftDelete = false,
  showDocuments = true,
  documents = [],
  documentAccessLog = [],
}: {
  matter: MatterDetail;
  team: TeamMember[];
  phone: string | null;
  email: string | null;
  tasks: TaskRow[];
  notes: { note_id: string; body: string; pinned: boolean; created_at: string }[];
  episodes: TreatmentEpisodeRow[];
  claims: { claim_id: string; claim_number: string | null; claim_role: string; status: string | null }[];
  companions: {
    client_matter_id: string;
    matter_number: string | null;
    current_stage_code: string;
    person: { first_name: string; last_name: string } | null;
    copy_sharing_allowed?: boolean;
  }[];
  stalled: StalledRow | null;
  viewerRole?: StaffRoleCode | string;
  viewerIsAttorney?: boolean;
  pdClaims: PdClaimRow[];
  coverageBoxes: CoverageBoxState[];
  recordRequests: RecordRequestRow[];
  demands: DemandRow[];
  negotiations: NegotiationRow[];
  providerDirectory: ProviderDirectoryRow[];
  cmCandidates?: AssignableStaff[];
  phoneHistory?: ContactHistoryRow[];
  emailHistory?: ContactHistoryRow[];
  canSoftDelete?: boolean;
  showDocuments?: boolean;
  documents?: DocumentRow[];
  documentAccessLog?: AccessLogRow[];
}) {
  const router = useRouter();
  const [focus, setFocus] = useState(true);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [shareNoteToCompanions, setShareNoteToCompanions] = useState(false);
  const [followTitle, setFollowTitle] = useState("");
  const [followDue, setFollowDue] = useState("");
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({});

  const cm = team.find((t) => t.assignment_role === "case_manager");
  const pl = team.find(
    (t) =>
      t.assignment_role === "litigation_paralegal" ||
      t.assignment_role === "senior_paralegal",
  );
  const atty = team.find((t) => t.assignment_role === "attorney");
  const flags = stalled ? flagList(stalled) : [];
  const openTasks = tasks.filter((t) =>
    ["open", "in_progress"].includes(t.status),
  );
  const doneTasks = tasks.filter((t) => t.status === "done");

  function isOpen(id: string, hot = false) {
    if (!focus) return true;
    if (openCards[id] != null) return openCards[id];
    return hot;
  }

  function toggle(id: string) {
    setOpenCards((s) => ({ ...s, [id]: !isOpen(id) }));
  }

  function jump(key: string) {
    const id = JUMP[key];
    if (!id) return;
    setOpenCards((s) => ({ ...s, [id]: true }));
    setTimeout(() => {
      const el = document.getElementById(id);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
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

  const ageDays = matter.sign_up_date
    ? Math.floor(
        (Date.now() - new Date(matter.sign_up_date + "T12:00:00").getTime()) /
          86400000,
      )
    : null;

  return (
    <div className="space-y-4">
      <Link
        href="/cases"
        className="inline-block text-sm text-accent-dk no-underline hover:underline"
      >
        ← Back to caseload
      </Link>

      {/* Header */}
      <section className="rounded-panel border border-grid bg-surface p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{matter.display_name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span className="rounded-md bg-info-bg px-2 py-0.5 text-xs font-semibold text-info">
                {STAGE_LABEL[matter.current_stage_code] ??
                  matter.current_stage_code}
              </span>
              {matter.approved_level != null ? (
                <span>Level {matter.approved_level}</span>
              ) : (
                <span className="font-semibold text-danger">Level missing</span>
              )}
              {matter.minor_or_incapacitated && (
                <span className="rounded-md bg-warning-bg px-2 py-0.5 text-[10px] font-bold uppercase text-warning">
                  MINOR
                </span>
              )}
              {stalled?.tbi_indicated && (
                <span className="rounded-md bg-danger-bg px-2 py-0.5 text-[10px] font-bold uppercase text-danger">
                  TBI
                </span>
              )}
            </div>
            <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <div>
                <span className="text-muted">Type / DOI — </span>
                {caseTypeLabel(matter.incident?.case_type_code)} ·{" "}
                {formatDate(matter.incident?.date_of_loss)}
              </div>
              <div>
                <span className="text-muted">Sign-up / age — </span>
                {formatDate(matter.sign_up_date)}
                {ageDays != null ? ` · ${ageDays}d` : ""}
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
                )}{" "}
                · Atty: {atty?.name ?? "—"}
              </div>
            </dl>
          </div>
          <div className="flex flex-col items-end gap-2">
            {viewerRole && canSwitchCmLit(viewerRole) && (
              <MatterViewToggle
                matterId={matter.client_matter_id}
                active="cases"
                viewerRole={viewerRole}
              />
            )}
            <button
              type="button"
              onClick={() => setFocus((f) => !f)}
              className="rounded-lg border border-grid px-3 py-2 text-sm font-semibold hover:bg-surface-2"
            >
              {focus ? "🗂 Full view" : "🎯 Focus view"}
            </button>
          </div>
        </div>

        {/* Contact strip */}
        <div className="mt-4 flex flex-wrap gap-6 border-t border-grid pt-3 text-sm">
          <div>
            <span className="text-muted">Phone — </span>
            <EditableContact
              personId={matter.client_person_id}
              kind="phone"
              value={phone}
              history={phoneHistory}
              matterId={matter.client_matter_id}
            />
          </div>
          <div>
            <span className="text-muted">Email — </span>
            {matter.in_person_signing && !email ? (
              "waived (in-person)"
            ) : (
              <EditableContact
                personId={matter.client_person_id}
                kind="email"
                value={email}
                history={emailHistory}
                matterId={matter.client_matter_id}
              />
            )}
          </div>
          <div>
            <span className="text-muted">DOB — </span>
            {formatDate(matter.person?.date_of_birth)}
          </div>
          <div>
            <span className="text-muted">Language — </span>
            {matter.person?.preferred_language === "es"
              ? "Spanish"
              : matter.person?.preferred_language === "en"
                ? "English"
                : (matter.person?.preferred_language ?? "—")}
          </div>
        </div>

        {canSoftDelete ? (
          <div className="mt-4">
            <ConfirmDeleteDialog
              title="Soft-delete this matter?"
              entityLabel="matter"
              confirmHint={
                matter.matter_number ||
                matter.person?.last_name ||
                "LASTNAME"
              }
              redirectTo="/cases"
              onConfirm={(confirmText) =>
                softDeleteMatterAction({
                  matterId: matter.client_matter_id,
                  confirmText,
                })
              }
            />
          </div>
        ) : null}

        {/* Badge wall — status as links */}
        <div className="mt-4 flex flex-wrap gap-2">
          <StatusLink
            label="Checklist"
            ok={openTasks.length === 0}
            onClick={() => jump("checklist")}
          />
          <StatusLink
            label="Treatment"
            ok={episodes.length > 0}
            onClick={() => jump("treatment")}
          />
          <StatusLink
            label="Coverage"
            ok={coverageBoxes.every((b) => b.status !== "unanswered")}
            onClick={() => jump("coverage")}
          />
          <StatusLink
            label="PD"
            ok={
              pdClaims.length === 0 ||
              pdClaims.every((p) => p.status === "resolved" || p.status === "n_a")
            }
            onClick={() => jump("pd")}
          />
          <StatusLink
            label="Records"
            ok={
              recordRequests.length === 0 ||
              recordRequests.every((r) => r.status === "received")
            }
            onClick={() => jump("records")}
          />
          {showDocuments ? (
            <StatusLink
              label="Documents"
              ok={documents.length > 0}
              onClick={() => jump("documents")}
            />
          ) : null}
          <StatusLink
            label="Demand"
            ok={demands.some((d) => d.sent_date)}
            onClick={() => jump("demand")}
          />
          <StatusLink
            label="Insurance"
            ok={claims.length > 0}
            onClick={() => jump("insurance")}
          />
          <StatusLink
            label="Notes"
            ok={notes.length > 0}
            onClick={() => jump("notes")}
          />
          {companions.length > 0 && (
            <StatusLink
              label={`Companions (${companions.length})`}
              ok
              onClick={() => jump("companion")}
            />
          )}
        </div>
      </section>

      {focus && flags.length > 0 && (
        <section className="rounded-panel border border-danger/40 bg-danger-bg px-4 py-3 text-sm text-danger shadow-soft">
          <div className="font-bold">🎯 Needs you now</div>
          <ul className="mt-1 list-disc pl-5">
            {flags.map((f) => (
              <li key={f}>{f}</li>
            ))}
            {openTasks.length > 0 && (
              <li>
                {openTasks.length} open checklist / task
                {openTasks.length === 1 ? "" : "s"}
              </li>
            )}
          </ul>
        </section>
      )}

      {msg && <p className="text-sm font-semibold text-success">{msg}</p>}
      {err && <p className="text-sm font-semibold text-danger">{err}</p>}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Card
            id="card-followup"
            title="Client called — create follow-up"
            open={isOpen("card-followup", true)}
            onToggle={() => toggle("card-followup")}
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
                    createFollowUpTaskAction({
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

          {companions.length > 0 && (
            <Card
              id="card-companion"
              title={`Companion cases (${companions.length})`}
              open={isOpen("card-companion", true)}
              onToggle={() => toggle("card-companion")}
            >
              <ul className="space-y-2 text-sm">
                {companions.map((c) => (
                  <li key={c.client_matter_id}>
                    <Link
                      href={`/cases/${c.client_matter_id}`}
                      className="font-semibold text-accent-dk no-underline hover:underline"
                    >
                      {c.person
                        ? `${c.person.last_name}, ${c.person.first_name}`
                        : c.matter_number}
                    </Link>
                    <span className="ml-2 text-xs text-muted">
                      {STAGE_LABEL[c.current_stage_code] ?? c.current_stage_code}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card
            id="card-checklist"
            title={`Sign-up checklist · ${doneTasks.length}/${tasks.length || openTasks.length}`}
            open={isOpen("card-checklist", openTasks.length > 0)}
            onToggle={() => toggle("card-checklist")}
          >
            {tasks.length === 0 ? (
              <p className="text-sm text-muted">No tasks on this matter yet.</p>
            ) : (
              <ul className="space-y-2">
                {tasks.map((t) => (
                  <li
                    key={t.task_id}
                    className="flex items-start gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={t.status === "done"}
                      disabled={pending}
                      onChange={() =>
                        run(() =>
                          t.status === "done"
                            ? reopenTaskAction(t.task_id)
                            : completeTaskAction(t.task_id),
                        )
                      }
                      className="mt-1 h-4 w-4 cursor-pointer accent-blue-700 disabled:cursor-wait"
                    />
                    <div>
                      <div
                        className={
                          t.status === "done"
                            ? "text-muted line-through"
                            : "font-semibold text-ink"
                        }
                      >
                        {t.title}
                      </div>
                      <div className="text-xs text-muted">
                        {t.trigger_source ?? t.task_type ?? "task"}
                        {t.due_date ? ` · due ${formatDate(t.due_date)}` : ""}
                        {pending ? "" : " · click to complete"}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            id="card-treatment"
            title={`Treatment · ${episodes.length} episode${episodes.length === 1 ? "" : "s"}`}
            open={isOpen("card-treatment", episodes.some((e) => ["gap_concern", "noncompliant"].includes(e.status)))}
            onToggle={() => toggle("card-treatment")}
          >
            {episodes.length === 0 ? (
              <p className="text-sm text-muted">
                No treatment episodes yet. Add providers as care starts.
              </p>
            ) : (
              <>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs text-muted">
                      <th className="py-1 font-semibold">Provider</th>
                      <th className="py-1 font-semibold">Status</th>
                      <th className="py-1 font-semibold">Visits</th>
                      <th className="py-1 font-semibold">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {episodes.map((e) => (
                      <tr
                        key={e.treatment_episode_id}
                        className="border-t border-grid"
                      >
                        <td className="py-2">
                          <div className="font-semibold">
                            {e.provider_name ?? "Provider"}
                          </div>
                          <div className="text-xs text-muted">
                            {e.provider_type ?? "—"}
                            {e.is_primary_pm ? " · Primary PM" : ""}
                            {e.under_lop ? " · LOP" : ""}
                          </div>
                        </td>
                        <td className="py-2">{e.status}</td>
                        <td className="py-2 text-xs text-muted">
                          {formatDate(e.first_visit_date)}
                          {e.last_visit_date
                            ? ` → ${formatDate(e.last_visit_date)}`
                            : ""}
                        </td>
                        <td className="py-2">
                          {e.approx_balance != null
                            ? `$${Number(e.approx_balance).toLocaleString()}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {episodes.some((e) => e.is_primary_pm) && (
                  <p className="mt-3 text-xs text-muted">
                    Primary PM bi-weekly checks live on{" "}
                    <Link
                      href="/cases/calls"
                      className="font-semibold text-accent-dk hover:underline"
                    >
                      Provider Calls
                    </Link>
                    .
                  </p>
                )}
              </>
            )}
          </Card>

          <Card
            id="card-coverage"
            title={`Coverage boxes · ${coverageBoxes.filter((b) => b.status === "unanswered").length} open`}
            open={isOpen(
              "card-coverage",
              coverageBoxes.some((b) => b.status === "unanswered"),
            )}
            onToggle={() => toggle("card-coverage")}
          >
            <CoverageBoxesCard
              matterId={matter.client_matter_id}
              boxes={coverageBoxes}
              episodes={episodes}
              directory={providerDirectory}
              pending={pending}
              run={run}
            />
          </Card>

          <Card
            id="card-pd"
            title={`Property damage · ${pdClaims.length}`}
            open={isOpen(
              "card-pd",
              Boolean(stalled?.flag_pd_unresolved) ||
                pdClaims.some((p) => p.status === "in_progress"),
            )}
            onToggle={() => toggle("card-pd")}
          >
            <PropertyDamageCard
              matterId={matter.client_matter_id}
              incidentGroupId={matter.incident_group_id}
              rows={pdClaims}
              pending={pending}
              run={run}
            />
          </Card>

          <Card
            id="card-records"
            title={`Records & bills · ${recordRequests.length}`}
            open={isOpen(
              "card-records",
              Boolean(stalled?.flag_records_not_ordered) ||
                recordRequests.some((r) =>
                  ["sent", "partial", "problem"].includes(r.status),
                ),
            )}
            onToggle={() => toggle("card-records")}
          >
            <RecordsTrackingCard
              matterId={matter.client_matter_id}
              episodes={episodes}
              rows={recordRequests}
              pending={pending}
              run={run}
            />
          </Card>

          {showDocuments ? (
            <Card
              id="card-documents"
              title={`Case documents · ${documents.length}`}
              open={isOpen("card-documents", true)}
              onToggle={() => toggle("card-documents")}
            >
              <DocumentsPanel
                matterId={matter.client_matter_id}
                documents={documents}
                accessLog={documentAccessLog}
              />
            </Card>
          ) : null}

          <Card
            id="card-demand"
            title={`Demand & negotiation · ${demands.length} demand${demands.length === 1 ? "" : "s"}`}
            open={isOpen(
              "card-demand",
              Boolean(stalled?.flag_demand_response_overdue) ||
                ["demand", "negotiation", "records"].includes(
                  matter.current_stage_code,
                ),
            )}
            onToggle={() => toggle("card-demand")}
          >
            <DemandNegotiationCard
              matterId={matter.client_matter_id}
              demands={demands}
              negotiations={negotiations}
              pending={pending}
              run={run}
            />
          </Card>

          <Card
            id="card-insurance"
            title={`Insurance & claims · ${claims.length}`}
            open={isOpen("card-insurance", claims.length === 0)}
            onToggle={() => toggle("card-insurance")}
          >
            {claims.length === 0 ? (
              <p className="text-sm text-muted">
                No claims on file yet. Open liability / first-party claims from
                Intake sign-up checklist path.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {claims.map((c) => (
                  <li key={c.claim_id}>
                    <span className="font-semibold">
                      {c.claim_number ?? "Claim"}
                    </span>
                    <span className="text-muted">
                      {" "}
                      · {c.claim_role} · {c.status ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card
            id="card-notes"
            title="Notes"
            open={isOpen("card-notes", notes.some((n) => n.pinned))}
            onToggle={() => toggle("card-notes")}
          >
            <ul className="mb-3 space-y-2 text-sm">
              {notes.length === 0 && (
                <li className="text-muted">No notes yet.</li>
              )}
              {notes.map((n) => (
                <li key={n.note_id} className="border-l-2 border-grid pl-2">
                  {n.pinned && (
                    <span className="mr-1 text-[10px] font-bold uppercase text-warning">
                      pinned
                    </span>
                  )}
                  <ExpandableNote text={n.body} />
                  <div className="text-xs text-muted">
                    {formatDate(n.created_at)}
                  </div>
                </li>
              ))}
            </ul>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Add a note…"
              className="w-full rounded-lg border border-grid bg-page px-3 py-2 text-sm"
            />
            {companions.length > 0 ? (
              <label className="mt-2 flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={shareNoteToCompanions}
                  onChange={(e) => setShareNoteToCompanions(e.target.checked)}
                />
                <span>
                  Also save to{" "}
                  <span className="font-semibold">
                    {companions.length} companion
                    {companions.length === 1 ? "" : "s"}
                  </span>
                  {companions.some((c) => !c.copy_sharing_allowed) ? (
                    <span className="block text-xs text-warning">
                      Some links lack conflict clearance — those will be
                      skipped.
                    </span>
                  ) : (
                    <span className="block text-xs text-muted">
                      Respects pairwise conflict clearance.
                    </span>
                  )}
                </span>
              </label>
            ) : null}
            <button
              type="button"
              disabled={pending || !note.trim()}
              onClick={() =>
                run(async () => {
                  const res = await addNoteAction(matter.client_matter_id, note, {
                    shareToCompanions: shareNoteToCompanions,
                  });
                  if (res.ok) {
                    setNote("");
                    setShareNoteToCompanions(false);
                  }
                  return res;
                })
              }
              className="mt-2 rounded-lg border border-grid px-3 py-1.5 text-sm font-semibold hover:bg-surface-2 disabled:opacity-50"
            >
              Save note
            </button>
          </Card>

          <Card
            id="card-actions"
            title="Next actions"
            open={isOpen("card-actions", openTasks.length > 0)}
            onToggle={() => toggle("card-actions")}
          >
            {openTasks.length === 0 ? (
              <p className="text-sm text-muted">Nothing queued.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {openTasks.slice(0, 8).map((t) => (
                  <li key={t.task_id}>
                    <span className="font-semibold">{t.title}</span>
                    {t.due_date && (
                      <span className="text-xs text-muted">
                        {" "}
                        · {formatDate(t.due_date)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/cases/tasks"
              className="mt-3 inline-block text-sm font-semibold text-accent-dk no-underline hover:underline"
            >
              Open My Tasks →
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="rounded-panel border border-grid bg-surface shadow-soft"
    >
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

function StatusLink({
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
