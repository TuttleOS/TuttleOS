"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatDate } from "@/lib/dates";
import {
  updatePersonAddressAction,
  type MailingAddressInput,
} from "@/lib/contacts/actions";

export type AddressValue = {
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};

export type AddressHistoryRow = {
  contact_point_id: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  valid_from: string | null;
  valid_to: string | null;
  deleted_at: string | null;
  updated_at: string;
};

export function formatMailingAddress(a: AddressValue | null | undefined): string {
  if (!a?.address_line1) return "";
  const cityState = [a.city, a.state].filter(Boolean).join(", ");
  const last = [cityState, a.zip].filter(Boolean).join(" ");
  return [a.address_line1, a.address_line2, last].filter(Boolean).join(", ");
}

export function EditableAddress({
  personId,
  value,
  history,
  matterId,
  leadId,
}: {
  personId: string;
  value: AddressValue | null;
  history: AddressHistoryRow[];
  matterId?: string;
  leadId?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [line1, setLine1] = useState(value?.address_line1 ?? "");
  const [line2, setLine2] = useState(value?.address_line2 ?? "");
  const [city, setCity] = useState(value?.city ?? "");
  const [state, setState] = useState(value?.state ?? "TX");
  const [zip, setZip] = useState(value?.zip ?? "");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const display = formatMailingAddress(value);

  function beginEdit() {
    setLine1(value?.address_line1 ?? "");
    setLine2(value?.address_line2 ?? "");
    setCity(value?.city ?? "");
    setState(value?.state ?? "TX");
    setZip(value?.zip ?? "");
    setEditing((e) => !e);
    setErr(null);
    setMsg(null);
  }

  function save() {
    setErr(null);
    setMsg(null);
    start(async () => {
      const payload: MailingAddressInput = {
        address_line1: line1,
        address_line2: line2,
        city,
        state,
        zip,
      };
      const res = await updatePersonAddressAction({
        personId,
        address: payload,
        matterId,
        leadId,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setMsg(res.message ?? "Updated");
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-start gap-2">
        {display ? (
          <span className="text-sm text-ink">{display}</span>
        ) : (
          <span className="text-muted">—</span>
        )}
        <button
          type="button"
          className="text-xs font-semibold text-accent-dk hover:underline"
          onClick={beginEdit}
        >
          {editing ? "Cancel" : display ? "Edit" : "Add"}
        </button>
        {history.length > 0 ? (
          <button
            type="button"
            className="text-xs font-semibold text-muted hover:underline"
            onClick={() => setShowHistory((h) => !h)}
          >
            {showHistory ? "Hide history" : `History (${history.length})`}
          </button>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-2 grid max-w-md gap-2">
          <input
            type="text"
            value={line1}
            onChange={(e) => setLine1(e.target.value)}
            placeholder="Street address *"
            className="rounded-lg border border-grid bg-page px-2 py-1 text-sm"
            disabled={pending}
          />
          <input
            type="text"
            value={line2}
            onChange={(e) => setLine2(e.target.value)}
            placeholder="Apt / suite (optional)"
            className="rounded-lg border border-grid bg-page px-2 py-1 text-sm"
            disabled={pending}
          />
          <div className="grid grid-cols-[1fr_70px_90px] gap-2">
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              className="rounded-lg border border-grid bg-page px-2 py-1 text-sm"
              disabled={pending}
            />
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="ST"
              className="rounded-lg border border-grid bg-page px-2 py-1 text-sm uppercase"
              disabled={pending}
              maxLength={2}
            />
            <input
              type="text"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="ZIP"
              className="rounded-lg border border-grid bg-page px-2 py-1 text-sm"
              disabled={pending}
            />
          </div>
          <button
            type="button"
            disabled={pending || !line1.trim()}
            onClick={save}
            className="w-fit rounded-lg border border-grid px-2 py-1 text-xs font-semibold hover:bg-surface-2 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      ) : null}

      {err ? <p className="mt-1 text-xs text-danger">{err}</p> : null}
      {msg ? <p className="mt-1 text-xs text-success">{msg}</p> : null}

      {showHistory && history.length > 0 ? (
        <ul className="mt-2 space-y-1 border-l-2 border-grid pl-2 text-xs text-muted">
          {history.map((h) => {
            const prior = formatMailingAddress(h);
            const ended = h.valid_to ?? h.deleted_at ?? h.updated_at;
            return (
              <li key={h.contact_point_id}>
                <span className="font-medium text-ink">{prior || "—"}</span>
                {" · until "}
                {formatDate(ended)}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
