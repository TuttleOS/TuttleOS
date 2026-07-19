"use client";

import { useEffect, useState } from "react";

type PreviewPayload = {
  url: string;
  mimeType: string | null;
  title: string;
  filename: string | null;
};

function isImage(mime: string | null, filename: string | null): boolean {
  if (mime?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(filename ?? "");
}

function isPdf(mime: string | null, filename: string | null): boolean {
  if (mime === "application/pdf") return true;
  return /\.pdf$/i.test(filename ?? "");
}

export function DocumentPreviewModal({
  documentId,
  fallbackTitle,
  onClose,
}: {
  documentId: string;
  fallbackTitle: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [payload, setPayload] = useState<PreviewPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/documents/${documentId}/preview`);
        const data = (await res.json()) as PreviewPayload & { error?: string };
        if (!res.ok) {
          if (!cancelled) setErr(data.error || "Could not load preview");
          return;
        }
        if (!cancelled) setPayload(data);
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Preview failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title = payload?.title || fallbackTitle;
  const mime = payload?.mimeType ?? null;
  const filename = payload?.filename ?? null;
  const image = isImage(mime, filename);
  const pdf = isPdf(mime, filename);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${title}`}
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-panel border border-grid bg-surface shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-grid px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-ink">{title}</h2>
            {filename ? (
              <p className="truncate text-xs text-muted">{filename}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {payload?.url ? (
              <a
                href={payload.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-grid px-2.5 py-1 text-xs font-semibold text-accent-dk hover:bg-page"
              >
                Open in new tab
              </a>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-grid px-2.5 py-1 text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>

        <div className="min-h-[240px] flex-1 overflow-auto bg-page p-3">
          {loading ? (
            <p className="p-8 text-center text-sm text-muted">Loading preview…</p>
          ) : err ? (
            <p className="p-8 text-center text-sm text-danger">{err}</p>
          ) : payload?.url && image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={payload.url}
              alt={title}
              className="mx-auto max-h-[75vh] max-w-full object-contain"
            />
          ) : payload?.url && pdf ? (
            <iframe
              title={title}
              src={payload.url}
              className="h-[75vh] w-full rounded-lg border border-grid bg-white"
            />
          ) : payload?.url ? (
            <div className="flex flex-col items-center gap-3 p-10 text-center">
              <p className="text-sm text-muted">
                No in-browser preview for this file type
                {mime ? ` (${mime})` : ""}.
              </p>
              <a
                href={payload.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-accent-dk px-4 py-2 text-sm font-semibold text-white"
              >
                Open file
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Simple SVG eye — avoids emoji / font dependency. */
export function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className={className}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12s-3.75 6.75-9.75 6.75S2.25 12 2.25 12z"
      />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  );
}
