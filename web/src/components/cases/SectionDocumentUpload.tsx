"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
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

function titleFromFilename(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
}

/**
 * Compact uploader for matter cards (Records / PD / Demand).
 * Files still land in the shared case-documents vault with a pre-filled type.
 * Supports click + drag-and-drop onto the dashed zone.
 * Optional vehicle tag for PD photos.
 */
export function SectionDocumentUpload({
  matterId,
  defaultDocType,
  hint,
  relatedVehicleId,
  vehicleOptions,
}: {
  matterId: string;
  defaultDocType: string;
  hint?: string;
  /** Lock uploads to this vehicle (per-vehicle PD card). */
  relatedVehicleId?: string | null;
  /** Optional picker when tagging at section level. */
  vehicleOptions?: { id: string; label: string }[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pending, start] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState(defaultDocType);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [eventDate, setEventDate] = useState(todayIso());
  const [vehicleId, setVehicleId] = useState(
    relatedVehicleId ?? vehicleOptions?.[0]?.id ?? "",
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const dragDepth = useRef(0);

  function reset() {
    setFile(null);
    setTitle("");
    setNotes("");
    setEventDate(todayIso());
    setDocType(defaultDocType);
    setVehicleId(relatedVehicleId ?? vehicleOptions?.[0]?.id ?? "");
    if (fileRef.current) fileRef.current.value = "";
  }

  const acceptFile = useCallback((f: File | null) => {
    setMsg(null);
    setErr(null);
    if (!f) return;
    if (f.size > MAX_UPLOAD_BYTES) {
      setErr(`Max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB`);
      return;
    }
    setFile(f);
    setOpen(true);
    setTitle((t) => (t.trim() ? t : titleFromFilename(f.name)));
  }, []);

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    if (e.dataTransfer.types.includes("Files")) setDragging(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDragging(false);
    const f = e.dataTransfer.files?.[0] ?? null;
    acceptFile(f);
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

    const taggedVehicleId = relatedVehicleId || vehicleId || null;
    if (
      vehicleOptions &&
      vehicleOptions.length > 0 &&
      !relatedVehicleId &&
      !taggedVehicleId
    ) {
      setErr("Select which vehicle this photo belongs to");
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
          relatedVehicleId: taggedVehicleId,
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

  const showVehiclePicker =
    !relatedVehicleId && Boolean(vehicleOptions && vehicleOptions.length > 0);

  return (
    <div
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`rounded-lg border border-dashed px-3 py-2 transition ${
        dragging
          ? "border-accent bg-accent/15 ring-2 ring-accent/30"
          : "border-accent/40 bg-accent/5"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-ink">
            {dragging ? "Drop file to upload" : "Upload file to this case"}
          </p>
          <p className="text-[11px] text-muted">
            {dragging
              ? "Release to attach — then confirm title and Save to case."
              : hint
                ? `${hint} Drag a file here or use Upload…`
                : "Drag a file here or use Upload…"}
          </p>
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

      {msg ? <p className="mt-2 text-xs text-success">{msg}</p> : null}
      {err ? <p className="mt-2 text-xs text-danger">{err}</p> : null}

      {open ? (
        <div className="mt-3 space-y-2 border-t border-grid/80 pt-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
            className={`w-full rounded-lg border border-dashed px-3 py-3 text-left text-xs ${
              dragging
                ? "border-accent bg-accent/10"
                : "border-grid bg-surface"
            }`}
          >
            {file
              ? `${file.name} (${formatBytes(file.size)})`
              : "Choose file… or drop one on this box"}
          </button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              acceptFile(e.target.files?.[0] ?? null);
            }}
          />
          {showVehiclePicker ? (
            <label className="block text-xs">
              <span className="font-semibold text-muted">Vehicle *</span>
              <select
                className="mt-1 w-full rounded-lg border border-grid bg-surface px-2 py-1.5"
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                disabled={pending}
              >
                <option value="">Select vehicle…</option>
                {vehicleOptions!.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {relatedVehicleId ? (
            <p className="text-[11px] text-muted">
              Tagged to this vehicle on save.
            </p>
          ) : null}
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
