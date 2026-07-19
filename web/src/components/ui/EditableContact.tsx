"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatDate } from "@/lib/dates";
import { updatePersonContactAction } from "@/lib/contacts/actions";
import { CopyContact } from "@/components/ui/CopyContact";

export type ContactHistoryRow = {
  contact_point_id: string;
  phone: string | null;
  email: string | null;
  valid_from: string | null;
  valid_to: string | null;
  deleted_at: string | null;
  updated_at: string;
};

export function EditableContact({
  personId,
  kind,
  value,
  history,
  matterId,
  leadId,
}: {
  personId: string;
  kind: "phone" | "email";
  value: string | null;
  history: ContactHistoryRow[];
  matterId?: string;
  leadId?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  function save() {
    setErr(null);
    setMsg(null);
    start(async () => {
      const res = await updatePersonContactAction({
        personId,
        kind,
        value: draft,
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
      <div className="flex flex-wrap items-center gap-2">
        {value ? (
          <CopyContact value={value} kind={kind} />
        ) : (
          <span className="text-muted">—</span>
        )}
        <button
          type="button"
          className="text-xs font-semibold text-accent-dk hover:underline"
          onClick={() => {
            setDraft(value ?? "");
            setEditing((e) => !e);
            setErr(null);
            setMsg(null);
          }}
        >
          {editing ? "Cancel" : "Edit"}
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
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type={kind === "email" ? "email" : "tel"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="rounded-lg border border-grid bg-page px-2 py-1 text-sm"
            placeholder={kind === "phone" ? "(210) 555-0100" : "name@email.com"}
            disabled={pending}
          />
          <button
            type="button"
            disabled={pending || !draft.trim()}
            onClick={save}
            className="rounded-lg border border-grid px-2 py-1 text-xs font-semibold hover:bg-surface-2 disabled:opacity-50"
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
            const prior = kind === "phone" ? h.phone : h.email;
            const ended = h.valid_to ?? h.deleted_at ?? h.updated_at;
            return (
              <li key={h.contact_point_id}>
                <span className="font-medium text-ink">{prior ?? "—"}</span>
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
