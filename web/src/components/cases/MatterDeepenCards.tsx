"use client";

import { useState } from "react";
import { formatDate } from "@/lib/dates";
import {
  addProviderEpisodeAction,
  clearCoverageNaAction,
  createDemandAction,
  createRecordRequestAction,
  declareCoverageNaAction,
  logNegotiationAction,
  markDemandReviewedAction,
  startPdClaimAction,
  updatePdClaimAction,
  updateRecordRequestAction,
} from "@/lib/cases/actions";
import {
  defaultProviderTypeForCategory,
  PROVIDER_TYPE_OPTIONS,
  type CoverageCategoryCode,
} from "@/lib/cases/coverage";
import type {
  CoverageBoxState,
  DemandRow,
  NegotiationRow,
  PdClaimRow,
  ProviderDirectoryRow,
  RecordRequestRow,
} from "@/lib/cases/matterExtras";
import type { TreatmentEpisodeRow } from "@/lib/cases/types";
import { SectionDocumentUpload } from "@/components/cases/SectionDocumentUpload";

type RunFn = (
  fn: () => Promise<{ ok: boolean; error?: string; message?: string }>,
) => void;

export function PropertyDamageCard({
  matterId,
  incidentGroupId,
  rows,
  pending,
  run,
}: {
  matterId: string;
  incidentGroupId: string;
  rows: PdClaimRow[];
  pending: boolean;
  run: RunFn;
}) {
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [location, setLocation] = useState("");
  const [storage, setStorage] = useState(false);

  return (
    <div className="space-y-4 text-sm">
      <SectionDocumentUpload
        matterId={matterId}
        defaultDocType="photos_video"
        hint="Photos, estimates, repair bills — saved under Case documents."
      />
      {rows.length === 0 ? (
        <p className="text-muted">
          No PD claim yet. Vehicle location is required — tow yards start the
          storage clock.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.pd_claim_id}
              className="rounded-lg border border-grid bg-page px-3 py-2"
            >
              <div className="font-semibold">
                {[r.year, r.make, r.model].filter(Boolean).join(" ") || "Vehicle"}
              </div>
              <div className="text-xs text-muted">
                {r.current_location ?? "—"} · {r.status}
                {r.storage_accruing ? " · STORAGE ACCRUING" : ""}
                {r.last_touch_date
                  ? ` · touched ${formatDate(r.last_touch_date)}`
                  : ""}
              </div>
              {r.demand_blocker && (
                <p className="mt-1 text-xs font-bold text-danger">
                  Demand blocker — PD unresolved at demand stage
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-md border border-grid px-2 py-1 text-xs font-semibold"
                  onClick={() =>
                    run(() =>
                      updatePdClaimAction({
                        client_matter_id: matterId,
                        pd_claim_id: r.pd_claim_id,
                        vehicle_id: r.vehicle_id,
                        status: "resolved",
                      }),
                    )
                  }
                >
                  Mark resolved
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-md border border-grid px-2 py-1 text-xs font-semibold"
                  onClick={() =>
                    run(() =>
                      updatePdClaimAction({
                        client_matter_id: matterId,
                        pd_claim_id: r.pd_claim_id,
                        vehicle_id: r.vehicle_id,
                        demand_blocker: !r.demand_blocker,
                      }),
                    )
                  }
                >
                  Toggle demand blocker
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-md border border-grid px-2 py-1 text-xs font-semibold"
                  onClick={() =>
                    run(() =>
                      updatePdClaimAction({
                        client_matter_id: matterId,
                        pd_claim_id: r.pd_claim_id,
                        vehicle_id: r.vehicle_id,
                      }),
                    )
                  }
                >
                  Touch (reset aging)
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-grid pt-3">
        <p className="text-xs font-bold uppercase text-muted">Start PD track</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input
            placeholder="Year"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="h-9 rounded-lg border border-grid bg-page px-2"
          />
          <input
            placeholder="Make *"
            value={make}
            onChange={(e) => setMake(e.target.value)}
            className="h-9 rounded-lg border border-grid bg-page px-2"
          />
          <input
            placeholder="Model *"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="h-9 rounded-lg border border-grid bg-page px-2"
          />
          <input
            placeholder="Current location *"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="h-9 rounded-lg border border-grid bg-page px-2 sm:col-span-2"
          />
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={storage}
            onChange={(e) => setStorage(e.target.checked)}
          />
          Storage accruing
        </label>
        <button
          type="button"
          disabled={pending || !make.trim() || !model.trim() || !location.trim()}
          className="mt-2 rounded-lg bg-accent-dk px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          onClick={() =>
            run(() =>
              startPdClaimAction({
                client_matter_id: matterId,
                incident_group_id: incidentGroupId,
                year: year ? Number(year) : null,
                make,
                model,
                current_location: location,
                storage_accruing: storage,
              }),
            )
          }
        >
          Save vehicle + PD claim
        </button>
      </div>
    </div>
  );
}

export function CoverageBoxesCard({
  matterId,
  boxes,
  episodes,
  directory,
  pending,
  run,
}: {
  matterId: string;
  boxes: CoverageBoxState[];
  episodes: TreatmentEpisodeRow[];
  directory: ProviderDirectoryRow[];
  pending: boolean;
  run: RunFn;
}) {
  const unanswered = boxes.filter((b) => b.status === "unanswered").length;
  const [addFor, setAddFor] = useState<CoverageCategoryCode | null>(null);
  const [mode, setMode] = useState<"directory" | "new">("new");
  const [providerId, setProviderId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [ptype, setPtype] = useState("pain_management");
  const [lop, setLop] = useState(false);
  const [primary, setPrimary] = useState(false);

  function openAdd(code: CoverageCategoryCode) {
    setAddFor(code);
    setPtype(defaultProviderTypeForCategory(code));
    setMode("new");
    setProviderId("");
    setName("");
    setPhone("");
    setLop(false);
    setPrimary(code === "pain_mgmt");
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-muted">
        Every box must be answered — add a provider or mark N/A.{" "}
        {unanswered > 0 && (
          <span className="font-bold text-danger">
            {unanswered} unchecked
          </span>
        )}
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {boxes.map((b) => (
          <div
            key={b.code}
            className={`rounded-lg border px-3 py-2 ${
              b.status === "unanswered"
                ? "border-danger/50 bg-danger-bg/40"
                : b.status === "n_a"
                  ? "border-grid bg-surface-2/50"
                  : "border-success/40 bg-success-bg/30"
            }`}
          >
            <div className="text-xs font-bold uppercase tracking-wide">
              {b.status === "covered"
                ? "☑"
                : b.status === "n_a"
                  ? "N/A"
                  : "☐"}{" "}
              {b.label}
            </div>
            <div className="mt-1 text-[11px] text-muted">
              {b.status === "covered"
                ? `${b.episodeCount} episode${b.episodeCount === 1 ? "" : "s"}`
                : b.status === "n_a"
                  ? "Declared N/A"
                  : "Unanswered"}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {b.status !== "covered" && (
                <button
                  type="button"
                  className="rounded-md border border-grid px-1.5 py-0.5 text-[10px] font-semibold"
                  onClick={() => openAdd(b.code)}
                >
                  Add provider
                </button>
              )}
              {b.status === "unanswered" && (
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-md border border-grid px-1.5 py-0.5 text-[10px] font-semibold"
                  onClick={() =>
                    run(() =>
                      declareCoverageNaAction({
                        client_matter_id: matterId,
                        category: b.code,
                      }),
                    )
                  }
                >
                  N/A
                </button>
              )}
              {b.status === "n_a" && (
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-md border border-grid px-1.5 py-0.5 text-[10px] font-semibold"
                  onClick={() =>
                    run(() =>
                      clearCoverageNaAction({
                        client_matter_id: matterId,
                        category: b.code,
                      }),
                    )
                  }
                >
                  Undo N/A
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {addFor && (
        <div className="rounded-lg border border-grid bg-page p-3">
          <p className="text-xs font-bold uppercase text-muted">
            Add provider · {boxes.find((b) => b.code === addFor)?.label}
          </p>
          <div className="mt-2 flex gap-2 text-xs">
            <button
              type="button"
              className={mode === "new" ? "font-bold" : "text-muted"}
              onClick={() => setMode("new")}
            >
              New provider
            </button>
            <button
              type="button"
              className={mode === "directory" ? "font-bold" : "text-muted"}
              onClick={() => setMode("directory")}
            >
              Directory
            </button>
          </div>
          {mode === "directory" ? (
            <select
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              className="mt-2 h-9 w-full rounded-lg border border-grid bg-surface px-2"
            >
              <option value="">Select…</option>
              {directory.map((d) => (
                <option key={d.provider_id} value={d.provider_id}>
                  {d.name} ({d.provider_type})
                </option>
              ))}
            </select>
          ) : (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input
                placeholder="Provider name *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 rounded-lg border border-grid bg-surface px-2"
              />
              <input
                placeholder="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-9 rounded-lg border border-grid bg-surface px-2"
              />
              <select
                value={ptype}
                onChange={(e) => setPtype(e.target.value)}
                className="h-9 rounded-lg border border-grid bg-surface px-2 sm:col-span-2"
              >
                {PROVIDER_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={lop}
                onChange={(e) => setLop(e.target.checked)}
              />
              Under LOP
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={primary}
                onChange={(e) => setPrimary(e.target.checked)}
              />
              Primary PM
            </label>
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={pending}
              className="rounded-lg bg-accent-dk px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
              onClick={() =>
                run(async () => {
                  const res = await addProviderEpisodeAction({
                    client_matter_id: matterId,
                    provider_id: mode === "directory" ? providerId : undefined,
                    new_provider_name: mode === "new" ? name : undefined,
                    provider_type:
                      mode === "directory"
                        ? directory.find((d) => d.provider_id === providerId)
                            ?.provider_type ?? ptype
                        : ptype,
                    phone: mode === "new" ? phone : undefined,
                    under_lop: lop,
                    accepts_lop: lop,
                    is_primary_pm: primary,
                    coverage_category: addFor,
                  });
                  if (res.ok) setAddFor(null);
                  return res;
                })
              }
            >
              Save episode
            </button>
            <button
              type="button"
              className="rounded-lg border border-grid px-3 py-1.5 text-xs"
              onClick={() => setAddFor(null)}
            >
              Cancel
            </button>
          </div>
          {episodes.length > 0 && (
            <p className="mt-2 text-[11px] text-muted">
              Existing episodes stay listed in the Treatment card.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function RecordsTrackingCard({
  matterId,
  episodes,
  rows,
  pending,
  run,
}: {
  matterId: string;
  episodes: TreatmentEpisodeRow[];
  rows: RecordRequestRow[];
  pending: boolean;
  run: RunFn;
}) {
  const [episodeId, setEpisodeId] = useState(
    episodes[0]?.treatment_episode_id ?? "",
  );
  const [rtype, setRtype] = useState("records_and_bills");
  const [hipaa, setHipaa] = useState(false);

  return (
    <div className="space-y-3 text-sm">
      <SectionDocumentUpload
        matterId={matterId}
        defaultDocType="medical_records"
        hint="Medical records / bills PDF — also appears in Case documents."
      />
      {rows.length === 0 ? (
        <p className="text-muted">No records / bills requests yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.record_request_id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-grid py-2"
            >
              <div>
                <div className="font-semibold">
                  {r.provider_name ?? "Provider"} · {r.request_type}
                </div>
                <div className="text-xs text-muted">
                  {r.status}
                  {r.sent_date ? ` · sent ${formatDate(r.sent_date)}` : ""}
                  {r.follow_up_due
                    ? ` · follow-up ${formatDate(r.follow_up_due)}`
                    : ""}
                  {!r.hipaa_verified ? " · HIPAA?" : ""}
                </div>
              </div>
              <div className="flex gap-1">
                {r.status !== "received" && (
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded-md border border-grid px-2 py-1 text-xs font-semibold"
                    onClick={() =>
                      run(() =>
                        updateRecordRequestAction({
                          client_matter_id: matterId,
                          record_request_id: r.record_request_id,
                          status: "sent",
                          follow_up_due: new Date(
                            Date.now() + 14 * 86400000,
                          )
                            .toISOString()
                            .slice(0, 10),
                        }),
                      )
                    }
                  >
                    Mark sent
                  </button>
                )}
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-md border border-grid px-2 py-1 text-xs font-semibold"
                  onClick={() =>
                    run(() =>
                      updateRecordRequestAction({
                        client_matter_id: matterId,
                        record_request_id: r.record_request_id,
                        status: "received",
                        received_date: new Date().toISOString().slice(0, 10),
                      }),
                    )
                  }
                >
                  Received
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {episodes.length === 0 ? (
        <p className="text-xs text-muted">
          Add a treatment episode before requesting records.
        </p>
      ) : (
        <div className="border-t border-grid pt-3">
          <p className="text-xs font-bold uppercase text-muted">New request</p>
          <select
            value={episodeId}
            onChange={(e) => setEpisodeId(e.target.value)}
            className="mt-2 h-9 w-full rounded-lg border border-grid bg-page px-2"
          >
            {episodes.map((e) => (
              <option
                key={e.treatment_episode_id}
                value={e.treatment_episode_id}
              >
                {e.provider_name ?? "Provider"} ({e.provider_type})
              </option>
            ))}
          </select>
          <select
            value={rtype}
            onChange={(e) => setRtype(e.target.value)}
            className="mt-2 h-9 w-full rounded-lg border border-grid bg-page px-2"
          >
            <option value="records">Records</option>
            <option value="bills">Bills</option>
            <option value="records_and_bills">Records + bills</option>
            <option value="affidavit_18001">18.001 affidavit</option>
            <option value="radiology_films">Radiology films</option>
          </select>
          <label className="mt-2 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={hipaa}
              onChange={(e) => setHipaa(e.target.checked)}
            />
            HIPAA auth verified
          </label>
          <button
            type="button"
            disabled={pending || !episodeId}
            className="mt-2 rounded-lg bg-accent-dk px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
            onClick={() =>
              run(() =>
                createRecordRequestAction({
                  client_matter_id: matterId,
                  treatment_episode_id: episodeId,
                  request_type: rtype,
                  status: "draft",
                  hipaa_verified: hipaa,
                }),
              )
            }
          >
            Create request
          </button>
        </div>
      )}
    </div>
  );
}

export function DemandNegotiationCard({
  matterId,
  demands,
  negotiations,
  pending,
  run,
}: {
  matterId: string;
  demands: DemandRow[];
  negotiations: NegotiationRow[];
  pending: boolean;
  run: RunFn;
}) {
  const [amount, setAmount] = useState("");
  const [negAmount, setNegAmount] = useState("");
  const [negType, setNegType] = useState("offer");
  const [bySide, setBySide] = useState("defense");

  return (
    <div className="space-y-4 text-sm">
      <SectionDocumentUpload
        matterId={matterId}
        defaultDocType="demand_letter"
        hint="Demand letter / attachments — saved under Case documents."
      />
      <div>
        <p className="text-xs font-bold uppercase text-muted">Demands</p>
        {demands.length === 0 ? (
          <p className="mt-1 text-muted">No demand drafts yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {demands.map((d) => (
              <li
                key={d.demand_id}
                className="rounded-lg border border-grid bg-page px-3 py-2"
              >
                <div className="font-semibold">
                  {d.demand_type}
                  {d.amount != null
                    ? ` · $${d.amount.toLocaleString()}`
                    : ""}
                </div>
                <div className="text-xs text-muted">
                  {d.sent_date
                    ? `Sent ${formatDate(d.sent_date)}`
                    : "Draft / unsent"}
                  {d.reviewed_at ? " · Kate reviewed" : " · awaiting review"}
                  {d.attorney_approved_at ? " · attorney approved" : ""}
                  {d.response_due
                    ? ` · response due ${formatDate(d.response_due)}`
                    : ""}
                </div>
                {!d.reviewed_at && (
                  <button
                    type="button"
                    disabled={pending}
                    className="mt-2 rounded-md border border-grid px-2 py-1 text-xs font-semibold"
                    onClick={() =>
                      run(() =>
                        markDemandReviewedAction({
                          client_matter_id: matterId,
                          demand_id: d.demand_id,
                        }),
                      )
                    }
                  >
                    Mark Kate-reviewed
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            type="number"
            placeholder="Demand amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-9 w-36 rounded-lg border border-grid bg-page px-2"
          />
          <button
            type="button"
            disabled={pending}
            className="rounded-lg bg-accent-dk px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            onClick={() =>
              run(() =>
                createDemandAction({
                  client_matter_id: matterId,
                  amount: amount ? Number(amount) : null,
                }),
              )
            }
          >
            Create draft demand
          </button>
        </div>
      </div>

      <div className="border-t border-grid pt-3">
        <p className="text-xs font-bold uppercase text-muted">Negotiation</p>
        {negotiations.length === 0 ? (
          <p className="mt-1 text-muted">No negotiation events logged.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {negotiations.map((n) => (
              <li key={n.negotiation_event_id} className="text-xs">
                <span className="font-semibold">{formatDate(n.event_date)}</span>
                {" · "}
                {n.event_type} · {n.by_side}
                {n.amount != null ? ` · $${n.amount.toLocaleString()}` : ""}
                {n.note ? ` — ${n.note}` : ""}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <select
            value={negType}
            onChange={(e) => setNegType(e.target.value)}
            className="h-9 rounded-lg border border-grid bg-page px-2"
          >
            <option value="offer">Offer</option>
            <option value="counter_offer">Counter-offer</option>
            <option value="counter_demand">Counter-demand</option>
            <option value="client_authority_obtained">Client authority</option>
            <option value="impasse">Impasse</option>
            <option value="acceptance">Acceptance</option>
          </select>
          <select
            value={bySide}
            onChange={(e) => setBySide(e.target.value)}
            className="h-9 rounded-lg border border-grid bg-page px-2"
          >
            <option value="defense">Defense</option>
            <option value="plaintiff">Plaintiff</option>
            <option value="client">Client</option>
            <option value="mediator">Mediator</option>
          </select>
          <input
            type="number"
            placeholder="Amount"
            value={negAmount}
            onChange={(e) => setNegAmount(e.target.value)}
            className="h-9 rounded-lg border border-grid bg-page px-2"
          />
          <button
            type="button"
            disabled={pending}
            className="rounded-lg border border-grid px-3 py-1.5 text-xs font-bold disabled:opacity-50"
            onClick={() =>
              run(() =>
                logNegotiationAction({
                  client_matter_id: matterId,
                  demand_id: demands[0]?.demand_id,
                  event_type: negType,
                  by_side: bySide,
                  amount: negAmount ? Number(negAmount) : null,
                }),
              )
            }
          >
            Log event
          </button>
        </div>
      </div>
    </div>
  );
}
