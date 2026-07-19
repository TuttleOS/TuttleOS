"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { DateField } from "@/components/ui/DateField";
import { createClient } from "@/lib/supabase/client";
import {
  CASE_DOCUMENTS_BUCKET,
  MAX_UPLOAD_BYTES,
} from "@/lib/documents/enabled";
import { completeDocumentUploadAction } from "@/lib/documents/actions";
import { DOC_TYPE_GROUPS, formatBytes } from "@/lib/documents/types";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const ALL_TYPES = DOC_TYPE_GROUPS.flatMap((g) => g.options);

/**
 * Compact uploader for matter cards (Records / PD / Demand).
 * Files still land in the shared case-documents vault with a pre-filled type.
 */
export function SectionDocumentUpload({
  matterId,
  defaultDocType,
  hint,
}: {
  matterId: string;
  defaultDocType: string;
  hint?: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState(defaultDocType);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [eventDate, setEventDate] = useState(todayIso());
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function reset() {
    setFile(null);
    setTitle("");
    setNotes("");
    setEventDate(todayIso());
    setDocType(defaultDocType);
    if (fileRef.current) fileRef.current.value = "";
  }

  function upload() {
    setMsg(null);
    setErr(null);
    if (!file) {
      setErr("Pick a file first");
      return;
    }
    if (!title.trim()) {
      setErr("Title is required");
      return;
    }
    if (!eventDate) {
      setErr("Date is required");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setErr(`Max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB`);
      return;
    }

    start(async () => {
      try {
        const res = await fetch("/api/documents/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matterId,
            filename: file.name,
            mimeType: file.type || null,
            byteSize: file.size,
            docTypeCode: docType,
          }),
        });
        const payload = (await res.json()) as {
          error?: string;
          documentId?: string;
          storagePath?: string;
          path?: string;
          token?: string;
        };
        if (!res.ok || !payload.documentId || !payload.path || !payload.token) {
          setErr(payload.error || "Could not start upload");
          return;
        }

        const supabase = createClient();
        const { error: upErr } = await supabase.storage
          .from(CASE_DOCUMENTS_BUCKET)
          .uploadToSignedUrl(payload.path, payload.token, file);
        if (upErr) {
          setErr(upErr.message);
          return;
        }

        const done = await completeDocumentUploadAction({
          documentId: payload.documentId,
          matterId,
          docTypeCode: docType,
          title: title.trim(),
          eventDate,
          storagePath: payload.storagePath!,
          mimeType: file.type || null,
          byteSize: file.size,
          originalFilename: file.name,
          notes: notes.trim() || null,
        });
        if (!done.ok) {
          setErr(done.error);
          return;
        }
        setMsg(done.message ?? "Saved to Case documents");
        reset();
        setOpen(false);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Upload failed");
      }
    });
  }

  return (
    <div className="rounded-lg border border-dashed border-accent/40 bg-accent/5 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-ink">Upload file to this case</p>
          {hint ? <p className="text-[11px] text-muted">{hint}</p> : null}
        </div>
        <button
          type="button"
          className="rounded-md border border-accent/50 px-2.5 py-1 text-xs font-semibold text-accent-dk"
          onClick={() => {
            setOpen((v) => !v);
            setErr(null);
            setMsg(null);
          }}
        >
          {open ? "Close" : "Upload…"}
        </button>
      </div>

      {msg ? (
        <p className="mt-2 text-xs text-success">{msg}</p>
      ) : null}
      {err ? (
        <p className="mt-2 text-xs text-danger">{err}</p>
      ) : null}

      {open ? (
        <div className="mt-3 space-y-2 border-t border-grid/80 pt-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-lg border border-dashed border-grid bg-surface px-3 py-3 text-left text-xs"
          >
            {file
              ? `${file.name} (${formatBytes(file.size)})`
              : "Choose file…"}
          </button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f && !title.trim()) {
                setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
              }
            }}
          />
          <label className="block text-xs">
            <span className="font-semibold text-muted">Type</span>
            <select
              className="mt-1 w-full rounded-lg border border-grid bg-surface px-2 py-1.5"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              disabled={pending}
            >
              {ALL_TYPES.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="font-semibold text-muted">Title</span>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-grid bg-surface px-2 py-1.5"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={pending}
            />
          </label>
          <label className="block text-xs">
            <span className="font-semibold text-muted">Notes (optional)</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-grid bg-surface px-2 py-1.5"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Client phone photos — front bumper"
              disabled={pending}
            />
          </label>
          <label className="block text-xs">
            <span className="font-semibold text-muted">Date (MM/DD/YYYY)</span>
            <DateField
              value={eventDate}
              onChange={setEventDate}
              disabled={pending}
              className="mt-1 w-full rounded-lg border border-grid bg-surface px-2 py-1.5"
            />
          </label>
          <button
            type="button"
            disabled={pending || !file}
            onClick={upload}
            className="rounded-lg border border-success px-3 py-1.5 text-xs font-semibold text-success disabled:opacity-50"
          >
            {pending ? "Uploading…" : "Save to case"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
