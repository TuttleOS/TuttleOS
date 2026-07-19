"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { formatDate, formatDateTime } from "@/lib/dates";
import { DateField } from "@/components/ui/DateField";
import { createClient } from "@/lib/supabase/client";
import {
  CASE_DOCUMENTS_BUCKET,
  MAX_UPLOAD_BYTES,
} from "@/lib/documents/enabled";
import {
  completeDocumentUploadAction,
  softDeleteDocumentAction,
} from "@/lib/documents/actions";
import {
  DOC_TYPE_GROUPS,
  FILING_DOC_TYPES,
  formatBytes,
  type AccessLogRow,
  type DocumentRow,
} from "@/lib/documents/types";
import {
  DocumentPreviewModal,
  EyeIcon,
} from "@/components/cases/DocumentPreviewModal";

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function DocumentsPanel({
  matterId,
  documents,
  accessLog,
}: {
  matterId: string;
  documents: DocumentRow[];
  accessLog: AccessLogRow[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("medical_records");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [eventDate, setEventDate] = useState(todayIso());
  const [batesStart, setBatesStart] = useState("");
  const [batesEnd, setBatesEnd] = useState("");
  const [supersedeId, setSupersedeId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentRow | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const dateLabel = FILING_DOC_TYPES.has(docType)
    ? "Filed / served date"
    : "Received date";

  const activeDocs = useMemo(
    () => documents.filter((d) => !d.is_superseded),
    [documents],
  );

  function onPick(f: File | null) {
    setFile(f);
    setErr(null);
    if (f && !title.trim()) {
      setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
    }
  }

  function resetForm() {
    setFile(null);
    setTitle("");
    setNotes("");
    setEventDate(todayIso());
    setBatesStart("");
    setBatesEnd("");
    setSupersedeId(null);
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
      setErr(
        `File exceeds ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB limit`,
      );
      return;
    }

    start(async () => {
      try {
        setProgress("Requesting upload…");
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
          setProgress(null);
          return;
        }

        setProgress("Uploading file…");
        const supabase = createClient();
        const { error: upErr } = await supabase.storage
          .from(CASE_DOCUMENTS_BUCKET)
          .uploadToSignedUrl(payload.path, payload.token, file);
        if (upErr) {
          setErr(upErr.message);
          setProgress(null);
          return;
        }

        setProgress("Saving case record…");
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
          batesStart: batesStart || null,
          batesEnd: batesEnd || null,
          supersedesDocumentId: supersedeId,
        });
        setProgress(null);
        if (!done.ok) {
          setErr(done.error);
          return;
        }
        setMsg(done.message ?? "Saved");
        resetForm();
        router.refresh();
      } catch (e) {
        setProgress(null);
        setErr(e instanceof Error ? e.message : "Upload failed");
      }
    });
  }

  function beginSupersede(doc: DocumentRow) {
    setSupersedeId(doc.document_id);
    setDocType(doc.doc_type_code);
    setTitle(`${doc.title} (corrected)`);
    setEventDate(todayIso());
    setMsg(`Upload a new file to supersede: ${doc.title}`);
    setErr(null);
    fileRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="space-y-6 text-sm">
      {msg && (
        <p className="rounded-lg bg-success-bg px-3 py-2 text-xs text-success">
          {msg}
        </p>
      )}
      {err && (
        <p className="rounded-lg bg-danger-bg px-3 py-2 text-xs text-danger">
          {err}
        </p>
      )}

      <div className="space-y-3">
        <p className="text-xs text-muted">
          Bytes go to encrypted Storage; the database keeps the pointer and every
          date. No AI pass — storage only.
          {supersedeId ? (
            <span className="ml-1 font-semibold text-warning">
              Superseding prior version…
              <button
                type="button"
                className="ml-2 underline"
                onClick={() => setSupersedeId(null)}
              >
                Cancel
              </button>
            </span>
          ) : null}
        </p>

        <button
          type="button"
          disabled={pending}
          onClick={() => fileRef.current?.click()}
          className="w-full rounded-xl border-2 border-dashed border-accent bg-accent/5 px-4 py-6 text-center text-accent-dk transition hover:bg-accent/10"
        >
          <div className="font-semibold">
            Drop a file here or click to browse
          </div>
          <div className="mt-1 text-xs text-muted">
            {file
              ? `Selected: ${file.name} (${formatBytes(file.size)})`
              : `Up to ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB`}
          </div>
        </button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />

        <label className="block">
          <span className="text-xs font-semibold text-muted">Document type *</span>
          <select
            className="mt-1 w-full rounded-lg border border-grid bg-surface px-2.5 py-2"
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            disabled={pending}
          >
            {DOC_TYPE_GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.options.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-muted">Title *</span>
          <input
            type="text"
            className="mt-1 w-full rounded-lg border border-grid bg-surface px-2.5 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Alamo Orthopedics — records 03/14/2026–07/01/2026"
            disabled={pending}
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-muted">Notes (optional)</span>
          <textarea
            className="mt-1 w-full rounded-lg border border-grid bg-surface px-2.5 py-2 text-sm"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Context for who reads this later — not on the PDF itself"
            disabled={pending}
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-muted">{dateLabel} *</span>
          <div className="mt-1">
            <DateField
              value={eventDate}
              onChange={setEventDate}
              disabled={pending}
              className="w-full rounded-lg border border-grid bg-surface px-2.5 py-2"
            />
          </div>
        </label>

        {docType === "production" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-muted">Bates from</span>
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-grid bg-surface px-2.5 py-2"
                value={batesStart}
                onChange={(e) => setBatesStart(e.target.value)}
                placeholder="DEF 000001"
                disabled={pending}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-muted">Bates to</span>
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-grid bg-surface px-2.5 py-2"
                value={batesEnd}
                onChange={(e) => setBatesEnd(e.target.value)}
                placeholder="DEF 000214"
                disabled={pending}
              />
            </label>
          </div>
        ) : null}

        <button
          type="button"
          disabled={pending || !file}
          onClick={upload}
          className="rounded-lg border border-success px-3 py-2 text-sm font-semibold text-success disabled:opacity-50"
        >
          {pending ? progress || "Uploading…" : "Upload — save to case"}
        </button>
      </div>

      <div>
        <h4 className="text-sm font-bold text-ink">
          Documents on this case · {documents.length}
        </h4>
        <p className="mt-0.5 text-xs text-muted">
          Restricted rows (🔒) are hidden from intake. Files are immutable —
          corrections upload as a new version.
        </p>

        {documents.length === 0 ? (
          <p className="mt-3 text-muted">No documents yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="border-b border-grid text-muted">
                  <th className="py-2 pr-2 font-semibold">Type</th>
                  <th className="py-2 pr-2 font-semibold">Document</th>
                  <th className="py-2 pr-2 font-semibold">Status / dates</th>
                  <th className="py-2 pr-2 font-semibold">File</th>
                  <th className="py-2 font-semibold">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => (
                  <tr
                    key={d.document_id}
                    className="border-b border-grid/80 align-top"
                  >
                    <td className="py-2 pr-2">
                      <span className="rounded-full bg-page px-2 py-0.5 font-semibold">
                        {d.type_label ?? d.doc_type_code}
                      </span>
                      {d.restricted ? (
                        <div className="mt-0.5 text-[10px] text-muted">
                          🔒 no intake
                        </div>
                      ) : null}
                    </td>
                    <td
                      className={`py-2 pr-2 ${d.is_superseded ? "text-muted line-through" : ""}`}
                    >
                      <div className="font-semibold text-ink">{d.title}</div>
                      {d.notes ? (
                        <div className="mt-0.5 text-muted">{d.notes}</div>
                      ) : null}
                      {d.supersedes_title ? (
                        <div className="text-muted">
                          ↳ supersedes: {d.supersedes_title}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2 pr-2 text-muted">
                      {d.status}
                      {d.received_date
                        ? ` · ${formatDate(d.received_date)}`
                        : ""}
                      {d.bates_start ? (
                        <div>
                          Bates {d.bates_start}
                          {d.bates_end ? `–${d.bates_end}` : ""}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2 pr-2 text-muted">
                      {d.storage_path ? (
                        <>
                          <div>
                            {d.original_filename ?? "file"} ·{" "}
                            {formatBytes(d.byte_size)}
                          </div>
                          {!d.is_superseded ? (
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                title="Preview"
                                aria-label={`Preview ${d.title}`}
                                className="inline-flex items-center gap-1 rounded-md border border-grid px-1.5 py-0.5 font-semibold text-accent-dk hover:bg-page"
                                onClick={() => setPreviewDoc(d)}
                              >
                                <EyeIcon className="h-3.5 w-3.5" />
                                <span className="sr-only">Preview</span>
                              </button>
                              <a
                                className="font-semibold text-accent-dk hover:underline"
                                href={`/api/documents/${d.document_id}/download`}
                              >
                                Download
                              </a>
                              <button
                                type="button"
                                className="font-semibold text-ink hover:underline"
                                disabled={pending}
                                onClick={() => beginSupersede(d)}
                              >
                                New version
                              </button>
                              <button
                                type="button"
                                className="text-danger hover:underline"
                                disabled={pending}
                                onClick={() => {
                                  if (
                                    !confirm(
                                      "Soft-delete this document? The file stays in Storage; the row is hidden.",
                                    )
                                  ) {
                                    return;
                                  }
                                  start(async () => {
                                    const res = await softDeleteDocumentAction({
                                      documentId: d.document_id,
                                      matterId,
                                    });
                                    if (!res.ok) setErr(res.error);
                                    else {
                                      setMsg(res.message ?? "Deleted");
                                      router.refresh();
                                    }
                                  });
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </>
                      ) : d.dropbox_path ? (
                        <span title={d.dropbox_path}>Dropbox only</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 text-muted">
                      {d.uploader_name ?? "—"}
                      {d.uploaded_at ? (
                        <div>{formatDateTime(d.uploaded_at)}</div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeDocs.length === 0 && documents.length > 0 ? (
          <p className="mt-2 text-xs text-muted">
            All listed rows were superseded by newer versions.
          </p>
        ) : null}

        <div className="mt-3 rounded-lg border border-warning/40 bg-warning-bg/40 px-3 py-2 text-xs text-warning">
          Files are immutable — a corrected version uploads as a new file chained
          via supersedes. Deletes are soft. Legacy Dropbox paths can stay until
          re-uploaded.
        </div>
      </div>

      <div>
        <h4 className="text-sm font-bold text-ink">Access log</h4>
        <p className="mt-0.5 text-xs text-muted">
          Who viewed or downloaded which file (attorneys see all; staff see their
          own).
        </p>
        {accessLog.length === 0 ? (
          <p className="mt-2 text-muted">No access events yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-xs">
              <thead>
                <tr className="border-b border-grid text-muted">
                  <th className="py-2 pr-2 font-semibold">When</th>
                  <th className="py-2 pr-2 font-semibold">Who</th>
                  <th className="py-2 pr-2 font-semibold">Action</th>
                  <th className="py-2 font-semibold">Document</th>
                </tr>
              </thead>
              <tbody>
                {accessLog.map((r) => (
                  <tr key={r.access_id} className="border-b border-grid/80">
                    <td className="py-2 pr-2 text-muted">
                      {formatDateTime(r.accessed_at)}
                    </td>
                    <td className="py-2 pr-2">{r.staff_name ?? "—"}</td>
                    <td className="py-2 pr-2">
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 font-semibold text-accent-dk">
                        {r.action}
                      </span>
                    </td>
                    <td className="py-2">{r.document_title ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {previewDoc ? (
        <DocumentPreviewModal
          documentId={previewDoc.document_id}
          fallbackTitle={previewDoc.title}
          onClose={() => setPreviewDoc(null)}
        />
      ) : null}
    </div>
  );
}
