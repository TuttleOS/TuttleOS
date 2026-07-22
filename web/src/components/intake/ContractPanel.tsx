"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDate, todayIsoLocal } from "@/lib/dates";
import {
  clampFeeFiled,
  clampFeePreSuit,
  FEE_APPEAL_FIXED,
  FEE_FILED_DEFAULT,
  FEE_FILED_MAX,
  FEE_FILED_MIN,
  FEE_PRE_SUIT_DEFAULT,
  FEE_PRE_SUIT_MAX,
  FEE_PRE_SUIT_MIN,
} from "@/lib/contracts/fees";
import {
  createOrUpdateContractDraftAction,
  sendContractPackageAction,
  voidContractPackageAction,
  recoverContractPdfAction,
} from "@/lib/contracts/actions";
import { contractPublicUrl } from "@/lib/contracts/urls";
import { buildContractBodyHtml, buildMergeFields } from "@/lib/contracts/template";
import type { LeadContractPlan } from "@/lib/contracts/capacity";
import type {
  ContractPackage,
  ContractSigner,
  SignerCapacity,
} from "@/lib/contracts/types";
import { defaultCausePhrase } from "@/lib/intake/case-types";
import type { LeadRow } from "@/lib/intake/types";
import { leadDisplayName } from "@/lib/intake/display";

type CompanionOption = {
  intake_lead_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  person_id: string | null;
  status: string;
};

export type NextFriendContact = {
  person_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};

type LocalSigner = {
  key: string;
  full_name: string;
  email: string;
  phone: string;
  intake_lead_id?: string | null;
  person_id?: string | null;
  signer_capacity: SignerCapacity;
};

function planClientNames(
  plan: LeadContractPlan | null,
  fallback: string,
): string {
  if (!plan) return fallback;
  if (
    plan.kind === "adult_plain" ||
    plan.kind === "adult_with_wards" ||
    plan.kind === "minor_case_b"
  ) {
    return plan.clientDisplayNames;
  }
  return fallback;
}

function defaultSigners(
  lead: LeadRow,
  primaryName: string,
  activePackage: (ContractPackage & { signers: ContractSigner[] }) | null,
  nextFriend: NextFriendContact | null,
  plan: LeadContractPlan | null,
): LocalSigner[] {
  if (activePackage?.signers?.length) {
    return activePackage.signers.map((s) => ({
      key: s.contract_signer_id,
      full_name: s.full_name,
      email: s.email ?? "",
      phone: s.phone ?? "",
      intake_lead_id: s.intake_lead_id,
      person_id: s.person_id,
      signer_capacity: (s.signer_capacity as SignerCapacity) || "client",
    }));
  }

  if (
    plan?.kind === "minor_case_a" ||
    plan?.kind === "minor_incomplete"
  ) {
    return [];
  }

  // Case B: only the guardian signs the minor's contract
  if (plan?.kind === "minor_case_b") {
    if (!nextFriend) return [];
    return [
      {
        key: `nf-${nextFriend.person_id}`,
        full_name: nextFriend.full_name,
        email: nextFriend.email ?? "",
        phone: nextFriend.phone ?? "",
        person_id: nextFriend.person_id,
        signer_capacity: lead.not_drivers_child
          ? "parent_guardian"
          : "next_friend",
      },
    ];
  }

  // Adult (plain or with Case A wards): adult signs alone
  return [
    {
      key: "primary",
      full_name: primaryName,
      email: lead.raw_email ?? "",
      phone: lead.raw_phone ?? "",
      intake_lead_id: lead.intake_lead_id,
      person_id: lead.person_id,
      signer_capacity: "client",
    },
  ];
}

export function ContractPanel({
  lead,
  locationGuess,
  activePackage,
  companionOptions,
  gateReady,
  nextFriend = null,
  contractPlan = null,
}: {
  lead: LeadRow;
  locationGuess: string;
  activePackage: (ContractPackage & { signers: ContractSigner[] }) | null;
  companionOptions: CompanionOption[];
  gateReady: boolean;
  nextFriend?: NextFriendContact | null;
  contractPlan?: LeadContractPlan | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const primaryName =
    lead.person
      ? `${lead.person.first_name} ${lead.person.last_name}`.trim()
      : leadDisplayName(lead).includes(",")
        ? leadDisplayName(lead).split(",").reverse().join(" ").trim()
        : leadDisplayName(lead);

  const draftingBlocked =
    contractPlan?.kind === "minor_case_a" ||
    contractPlan?.kind === "minor_incomplete";

  const [location, setLocation] = useState(
    activePackage?.incident_location || locationGuess || "San Antonio",
  );
  const [incidentDate, setIncidentDate] = useState(
    activePackage?.incident_date || lead.incident_date || "",
  );
  const [causePhrase, setCausePhrase] = useState(
    activePackage?.cause_phrase ||
      defaultCausePhrase(lead.case_type_code, lead.case_type_other),
  );
  const [feePre, setFeePre] = useState(
    clampFeePreSuit(activePackage?.fee_pre_suit ?? FEE_PRE_SUIT_DEFAULT),
  );
  const [feePost, setFeePost] = useState(
    clampFeeFiled(activePackage?.fee_post_filing ?? FEE_FILED_DEFAULT),
  );
  const feeAppeal = FEE_APPEAL_FIXED;
  const [signers, setSigners] = useState<LocalSigner[]>(() =>
    defaultSigners(lead, primaryName, activePackage, nextFriend, contractPlan),
  );
  const [companionQuery, setCompanionQuery] = useState("");
  const [companionOpen, setCompanionOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const locked = ["sent", "partially_signed", "executed"].includes(
    activePackage?.status ?? "",
  );

  const clientDisplayNames = useMemo(
    () => planClientNames(contractPlan, primaryName),
    [contractPlan, primaryName],
  );

  const previewBodyHtml = useMemo(() => {
    const merge = buildMergeFields({
      clientNames: clientDisplayNames || "______________________",
      location,
      incidentDateDisplay: incidentDate
        ? formatDate(incidentDate)
        : "______________________",
      causePhrase,
      feePreSuit: feePre,
      feePostFiling: feePost,
      feeAppeal,
    });
    return buildContractBodyHtml(merge);
  }, [
    clientDisplayNames,
    location,
    incidentDate,
    causePhrase,
    feePre,
    feePost,
    feeAppeal,
  ]);

  const publicLink = activePackage?.public_token
    ? contractPublicUrl(activePackage.public_token)
    : null;

  const availableCompanions = useMemo(() => {
    const q = companionQuery.trim().toLowerCase();
    const wardIds = new Set(
      contractPlan?.kind === "adult_with_wards"
        ? contractPlan.wards.map((w) => w.intake_lead_id)
        : [],
    );
    return companionOptions
      .filter((c) => !signers.some((s) => s.intake_lead_id === c.intake_lead_id))
      .filter((c) => !wardIds.has(c.intake_lead_id))
      .filter((c) => {
        if (!q) return true;
        const hay = `${c.name} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 10);
  }, [companionOptions, signers, companionQuery, contractPlan]);

  function addCompanionLead(c: CompanionOption) {
    setSigners((prev) => {
      if (prev.some((s) => s.intake_lead_id === c.intake_lead_id)) return prev;
      return [
        ...prev,
        {
          key: c.intake_lead_id,
          full_name: c.name.includes(",")
            ? c.name.split(",").reverse().join(" ").trim()
            : c.name,
          email: c.email ?? "",
          phone: c.phone ?? "",
          intake_lead_id: c.intake_lead_id,
          person_id: c.person_id,
          signer_capacity: "client",
        },
      ];
    });
    setCompanionQuery("");
    setCompanionOpen(false);
  }

  function addManualSigner() {
    const name = companionQuery.trim();
    if (!name) return;
    setSigners((prev) => [
      ...prev,
      {
        key: `manual-${Date.now()}`,
        full_name: name,
        email: "",
        phone: "",
        signer_capacity:
          contractPlan?.kind === "minor_case_b"
            ? "parent_guardian"
            : "client",
      },
    ]);
    setCompanionQuery("");
    setCompanionOpen(false);
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string; message?: string; token?: string }>) {
    setErr(null);
    setMsg(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setErr(res.error ?? "Failed");
      else setMsg(res.message ?? "Done");
      router.refresh();
    });
  }

  return (
    <section className="rounded-panel border border-grid bg-surface p-5 shadow-soft">
      <h2 className="text-xs font-bold uppercase tracking-wide text-muted">
        Contingent fee contract
      </h2>
      <p className="mt-1 text-xs text-muted">
        One shared link for all parties. PDF files only after everyone signs.
      </p>

      {contractPlan?.kind === "minor_case_a" ? (
        <div className="mt-3 rounded-lg border border-accent/40 bg-page px-3 py-3 text-sm">
          <p className="font-semibold text-ink">Case A — rides on guardian contract</p>
          <p className="mt-1 text-xs text-muted">{contractPlan.message}</p>
          <Link
            href={`/intake/leads/${contractPlan.guardianLeadId}`}
            className="mt-2 inline-block text-xs font-bold text-accent-dk hover:underline"
          >
            Open {contractPlan.guardianName}&apos;s lead →
          </Link>
        </div>
      ) : null}

      {contractPlan?.kind === "minor_incomplete" ? (
        <div className="mt-3 rounded-lg border border-warning/40 bg-warning-bg/40 px-3 py-3 text-sm">
          <p className="font-semibold text-warning">Adult required</p>
          <p className="mt-1 text-xs text-muted">{contractPlan.message}</p>
        </div>
      ) : null}

      {contractPlan?.kind === "minor_case_b" ? (
        <div className="mt-3 rounded-lg border border-warning/40 bg-warning-bg/40 px-3 py-3 text-sm">
          <p className="font-semibold text-warning">Case B — guardian signs this contract</p>
          <p className="mt-1 text-xs text-muted">{contractPlan.helperText}</p>
          <p className="mt-2 text-[11px] text-muted">
            Contract names:{" "}
            <span className="font-semibold text-ink">
              {contractPlan.clientDisplayNames}
            </span>
          </p>
        </div>
      ) : null}

      {contractPlan?.kind === "adult_with_wards" ? (
        <div className="mt-3 rounded-lg border border-grid bg-page px-3 py-3 text-sm">
          <p className="font-semibold text-ink">
            Case A — includes minor(s) on this contract
          </p>
          <p className="mt-1 text-[11px] text-muted">
            Signature language:{" "}
            <span className="font-semibold text-ink">
              {contractPlan.clientDisplayNames}
            </span>
          </p>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {contractPlan.wards.map((w) => (
              <li key={w.intake_lead_id}>
                · {w.display_name}
                {w.relationship_to_driver
                  ? ` (${w.relationship_to_driver})`
                  : ""}
                {" — "}
                <Link
                  href={`/intake/leads/${w.intake_lead_id}`}
                  className="font-semibold text-accent-dk hover:underline"
                >
                  open lead
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted">
            Only you (the adult client) sign. Minors do not get a separate
            contract.
          </p>
        </div>
      ) : null}

      {activePackage ? (
        <div className="mt-3 rounded-lg border border-grid bg-page px-3 py-2 text-sm">
          Status:{" "}
          <span className="font-semibold capitalize">
            {activePackage.status.replaceAll("_", " ")}
          </span>
          {activePackage.client_display_names ? (
            <p className="mt-1 text-[11px] text-muted">
              Parties: {activePackage.client_display_names}
            </p>
          ) : null}
          {activePackage.signers?.length ? (
            <ul className="mt-2 space-y-1 text-xs">
              {activePackage.signers.map((s) => (
                <li key={s.contract_signer_id}>
                  {s.status === "signed" ? "✔" : "○"} {s.full_name}
                  {s.signer_capacity && s.signer_capacity !== "client"
                    ? ` (${s.signer_capacity.replaceAll("_", " ")})`
                    : ""}
                  {s.signed_at ? ` · ${formatDate(s.signed_at)}` : " · awaiting"}
                </li>
              ))}
            </ul>
          ) : null}
          {publicLink && activePackage.status !== "draft" ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <code className="block max-w-full truncate text-[11px] text-accent-dk">
                {publicLink}
              </code>
              <button
                type="button"
                className="text-xs font-semibold text-accent-dk hover:underline"
                onClick={async () => {
                  await navigator.clipboard.writeText(publicLink);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          ) : null}
          {activePackage.status === "executed" && activePackage.has_pdf ? (
            <div className="mt-3 rounded-lg border border-green-700/30 bg-green-50 px-3 py-3">
              <p className="text-xs font-semibold text-green-900">
                Executed contract filed
                {activePackage.executed_at
                  ? ` · ${formatDate(activePackage.executed_at)}`
                  : ""}
              </p>
              <p className="mt-1 text-[11px] text-green-900/80">
                Open the live contract page to review or print. PDF download is
                also available.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <a
                  className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-xs font-bold text-white hover:bg-neutral-800"
                  href={`/intake/contracts/${activePackage.contract_package_id}`}
                >
                  View &amp; print
                </a>
                <a
                  className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-900 hover:bg-neutral-50"
                  href={`/api/contracts/${activePackage.contract_package_id}/pdf`}
                >
                  Download PDF
                </a>
              </div>
            </div>
          ) : activePackage.status === "executed" ? (
            <div className="mt-3 rounded-lg border border-amber-600/40 bg-amber-50 px-3 py-3">
              <p className="text-xs font-semibold text-amber-900">
                All parties signed, but the PDF failed to file (earlier audit
                error). Generate it now.
              </p>
              <button
                type="button"
                disabled={pending}
                className="mt-2 inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                onClick={() =>
                  run(() =>
                    recoverContractPdfAction(
                      activePackage.contract_package_id,
                      lead.intake_lead_id,
                    ),
                  )
                }
              >
                Generate signed PDF
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {!locked && !draftingBlocked ? (
        <div className="mt-4 space-y-3 text-sm">
          <label className="block">
            <span className="text-xs font-semibold text-muted">Location (Texas)</span>
            <input
              className="mt-1 w-full rounded-lg border border-grid bg-page px-3 py-2"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-muted">Incident date</span>
            <input
              type="date"
              max={todayIsoLocal()}
              className="mt-1 w-full rounded-lg border border-grid bg-page px-3 py-2"
              value={incidentDate}
              onChange={(e) => setIncidentDate(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-muted">Cause phrase</span>
            <input
              className="mt-1 w-full rounded-lg border border-grid bg-page px-3 py-2"
              value={causePhrase}
              onChange={(e) => setCausePhrase(e.target.value)}
            />
          </label>

          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <span className="text-xs font-semibold text-muted">Pre-suit %</span>
              <input
                type="number"
                min={FEE_PRE_SUIT_MIN}
                max={FEE_PRE_SUIT_MAX}
                step={0.001}
                className="mt-1 w-full rounded-lg border border-grid bg-page px-2 py-2"
                value={feePre}
                onChange={(e) => setFeePre(Number(e.target.value))}
                onBlur={() => setFeePre((v) => clampFeePreSuit(v))}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-muted">Filed %</span>
              <input
                type="number"
                min={FEE_FILED_MIN}
                max={FEE_FILED_MAX}
                step={0.001}
                className="mt-1 w-full rounded-lg border border-grid bg-page px-2 py-2"
                value={feePost}
                onChange={(e) => setFeePost(Number(e.target.value))}
                onBlur={() => setFeePost((v) => clampFeeFiled(v))}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-muted">Appeal %</span>
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-grid bg-page px-2 py-2 opacity-70"
                value={feeAppeal}
                disabled
                readOnly
                title="Appeal fee is fixed at 50%"
              />
            </label>
          </div>
          <p className="text-[11px] text-muted">
            Pre-suit {FEE_PRE_SUIT_MIN}–{FEE_PRE_SUIT_MAX}% · Filed{" "}
            {FEE_FILED_MIN}–{FEE_FILED_MAX}% · Appeal locked at {FEE_APPEAL_FIXED}
            %. Client copy shows plain contract text (not highlighted).
          </p>

          <div>
            <div className="text-xs font-semibold text-muted">
              {contractPlan?.kind === "adult_with_wards" ||
              contractPlan?.kind === "minor_case_b"
                ? "Signer"
                : "Signers (same link)"}
            </div>
            {contractPlan?.kind === "minor_case_b" ? (
              <p className="mt-1 text-[11px] text-warning">
                Only the parent/guardian signs this minor&apos;s contract.
              </p>
            ) : null}
            <ul className="mt-2 space-y-2">
              {signers.map((s, idx) => (
                <li
                  key={s.key}
                  className="rounded-lg border border-grid bg-page px-3 py-2"
                >
                  {(s.signer_capacity === "next_friend" ||
                    s.signer_capacity === "parent_guardian") && (
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-warning">
                      {s.signer_capacity === "parent_guardian"
                        ? "Parent / guardian — must sign"
                        : "Next friend / adult — must sign"}
                    </div>
                  )}
                  <input
                    className="w-full bg-transparent text-sm font-semibold"
                    value={s.full_name}
                    onChange={(e) =>
                      setSigners((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, full_name: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <input
                      className="rounded border border-grid bg-surface px-2 py-1 text-xs"
                      placeholder="Email"
                      value={s.email}
                      onChange={(e) =>
                        setSigners((prev) =>
                          prev.map((x, i) =>
                            i === idx ? { ...x, email: e.target.value } : x,
                          ),
                        )
                      }
                    />
                    <input
                      className="rounded border border-grid bg-surface px-2 py-1 text-xs"
                      placeholder="Phone"
                      value={s.phone}
                      onChange={(e) =>
                        setSigners((prev) =>
                          prev.map((x, i) =>
                            i === idx ? { ...x, phone: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </div>
                  {idx > 0 && contractPlan?.kind !== "minor_case_b" ? (
                    <button
                      type="button"
                      className="mt-1 text-[11px] text-danger hover:underline"
                      onClick={() =>
                        setSigners((prev) => prev.filter((_, i) => i !== idx))
                      }
                    >
                      Remove
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>

            {contractPlan?.kind !== "minor_case_b" &&
            contractPlan?.kind !== "adult_with_wards" ? (
              <div className="relative mt-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Link companion / add signer
                </div>
                <div className="mt-1 flex gap-2">
                  <input
                    className="h-9 flex-1 rounded-lg border border-grid bg-page px-2 text-xs"
                    placeholder="Search leads by name, email, or phone…"
                    value={companionQuery}
                    onChange={(e) => {
                      setCompanionQuery(e.target.value);
                      setCompanionOpen(true);
                    }}
                    onFocus={() => setCompanionOpen(true)}
                    onBlur={() => {
                      window.setTimeout(() => setCompanionOpen(false), 150);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (availableCompanions[0]) {
                          addCompanionLead(availableCompanions[0]);
                        } else {
                          addManualSigner();
                        }
                      }
                      if (e.key === "Escape") setCompanionOpen(false);
                    }}
                  />
                  <button
                    type="button"
                    className="rounded-lg border border-grid px-2 text-xs font-semibold hover:bg-surface-2"
                    onClick={() => {
                      if (availableCompanions[0] && companionQuery.trim()) {
                        addCompanionLead(availableCompanions[0]);
                      } else {
                        addManualSigner();
                      }
                    }}
                  >
                    Add
                  </button>
                </div>
                {companionOpen &&
                (availableCompanions.length > 0 || companionQuery.trim()) ? (
                  <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-grid bg-surface py-1 shadow-soft">
                    {availableCompanions.map((c) => (
                      <li key={c.intake_lead_id}>
                        <button
                          type="button"
                          className="flex w-full flex-col px-3 py-2 text-left text-xs hover:bg-page"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => addCompanionLead(c)}
                        >
                          <span className="font-semibold text-ink">{c.name}</span>
                          <span className="text-muted">
                            {c.status}
                            {c.email ? ` · ${c.email}` : ""}
                            {c.phone ? ` · ${c.phone}` : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                    {companionQuery.trim() &&
                    !availableCompanions.some(
                      (c) =>
                        c.name.toLowerCase() ===
                        companionQuery.trim().toLowerCase(),
                    ) ? (
                      <li>
                        <button
                          type="button"
                          className="flex w-full px-3 py-2 text-left text-xs font-semibold text-accent-dk hover:bg-page"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={addManualSigner}
                        >
                          Add “{companionQuery.trim()}” as new signer
                        </button>
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>

          {showPreview ? (
            <div className="rounded-lg border border-grid bg-page p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted">
                  Contract preview
                </h3>
                <button
                  type="button"
                  className="text-[11px] font-semibold text-muted hover:underline"
                  onClick={() => setShowPreview(false)}
                >
                  Close
                </button>
              </div>
              <div
                className="contract-body max-h-96 overflow-auto text-[12px] leading-relaxed text-ink [&_.contract-field]:font-bold [&_p]:mb-2"
                dangerouslySetInnerHTML={{ __html: previewBodyHtml }}
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              disabled={!clientDisplayNames.trim()}
              onClick={() => setShowPreview((p) => !p)}
              className="rounded-lg border border-grid bg-surface px-3 py-2 text-sm font-semibold text-ink hover:bg-surface-2 disabled:opacity-50"
            >
              {showPreview ? "Hide contract preview" : "Preview contract"}
            </button>
            <button
              type="button"
              disabled={pending || !gateReady || !signers.length}
              onClick={() =>
                run(() =>
                  createOrUpdateContractDraftAction({
                    leadId: lead.intake_lead_id,
                    location,
                    incidentDate,
                    causePhrase,
                    feePreSuit: feePre,
                    feePostFiling: feePost,
                    feeAppeal,
                    clientDisplayNames,
                    signers: signers.map((s) => ({
                      full_name: s.full_name,
                      email: s.email || null,
                      phone: s.phone || null,
                      intake_lead_id: s.intake_lead_id || null,
                      person_id: s.person_id || null,
                      signer_capacity: s.signer_capacity,
                    })),
                  }),
                )
              }
              className="rounded-lg border border-grid px-3 py-2 text-sm font-semibold hover:bg-surface-2 disabled:opacity-50"
            >
              Save contract draft
            </button>
            <button
              type="button"
              disabled={pending || !gateReady || !activePackage}
              onClick={() =>
                run(async () => {
                  if (!activePackage) {
                    return { ok: false, error: "Save draft first" };
                  }
                  return sendContractPackageAction(
                    activePackage.contract_package_id,
                    lead.intake_lead_id,
                  );
                })
              }
              className="rounded-lg bg-accent-dk px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              Send / open signing link
            </button>
          </div>
        </div>
      ) : locked ? (
        <div className="mt-3 flex flex-col gap-2">
          {activePackage && activePackage.status !== "executed" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() =>
                  voidContractPackageAction(
                    activePackage.contract_package_id,
                    lead.intake_lead_id,
                  ),
                )
              }
              className="rounded-lg border border-danger px-3 py-2 text-sm font-semibold text-danger disabled:opacity-50"
            >
              Void & start over
            </button>
          ) : null}
        </div>
      ) : null}

      {err ? <p className="mt-2 text-xs font-semibold text-danger">{err}</p> : null}
      {msg ? <p className="mt-2 text-xs font-semibold text-success">{msg}</p> : null}
      {!gateReady && !draftingBlocked ? (
        <p className="mt-2 text-xs text-warning">
          Complete the six-minimum gate before sending a contract.
        </p>
      ) : null}
    </section>
  );
}
