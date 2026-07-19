"use client";

import { useEffect } from "react";

function isImage(mime: string | null, filename: string | null): boolean {
  if (mime?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(filename ?? "");
}

function isPdf(mime: string | null, filename: string | null): boolean {
  if (mime === "application/pdf") return true;
  return /\.pdf$/i.test(filename ?? "");
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

/**
 * Same-origin preview — files stream through /api/documents/[id]/file
 * so Supabase signed-URL framing / CSP does not block the modal.
 */
export function DocumentPreviewModal({
  documentId,
  fallbackTitle,
  mimeType,
  filename,
  onClose,
}: {
  documentId: string;
  fallbackTitle: string;
  mimeType?: string | null;
  filename?: string | null;
  onClose: () => void;
}) {
  const fileUrl = `/api/documents/${documentId}/file`;
  const image = isImage(mimeType ?? null, filename ?? null);
  const pdf = isPdf(mimeType ?? null, filename ?? null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${fallbackTitle}`}
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-panel border border-grid bg-surface shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-grid px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-ink">{fallbackTitle}</h2>
            {filename ? (
              <p className="truncate text-xs text-muted">{filename}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-grid px-2.5 py-1 text-xs font-semibold text-accent-dk hover:bg-page"
            >
              Open in new tab
            </a>
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
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fileUrl}
              alt={fallbackTitle}
              className="mx-auto max-h-[75vh] max-w-full object-contain"
            />
          ) : pdf ? (
            <iframe
              title={fallbackTitle}
              src={fileUrl}
              className="h-[75vh] w-full rounded-lg border border-grid bg-white"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 p-10 text-center">
              <p className="text-sm text-muted">
                No in-browser preview for this file type
                {mimeType ? ` (${mimeType})` : ""}.
              </p>
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-accent-dk px-4 py-2 text-sm font-semibold text-white"
              >
                Open file
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
