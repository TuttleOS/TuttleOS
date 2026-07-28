"use client";

import { useMemo, useState } from "react";
import { DocumentPreviewModal } from "@/components/cases/DocumentPreviewModal";
import type { DocumentRow } from "@/lib/documents/types";

function isImage(mime: string | null, filename: string | null): boolean {
  if (mime?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(filename ?? "");
}

function isVideo(mime: string | null, filename: string | null): boolean {
  if (mime?.startsWith("video/")) return true;
  return /\.(mp4|mov|webm|m4v)$/i.test(filename ?? "");
}

/**
 * Thumbnail strip for section uploads (e.g. PD photos).
 * Click opens the shared document lightbox.
 */
export function SectionPhotoGallery({
  documents,
  docTypeCode = "photos_video",
  heading = "Uploaded photos",
}: {
  documents: DocumentRow[];
  docTypeCode?: string;
  heading?: string;
}) {
  const [preview, setPreview] = useState<DocumentRow | null>(null);

  const items = useMemo(
    () =>
      documents.filter(
        (d) =>
          d.doc_type_code === docTypeCode &&
          Boolean(d.storage_path) &&
          !d.is_superseded,
      ),
    [documents, docTypeCode],
  );

  if (items.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase text-muted">
        {heading} · {items.length}
      </p>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {items.map((d) => {
          const image = isImage(d.mime_type, d.original_filename);
          const video = isVideo(d.mime_type, d.original_filename);
          const fileUrl = `/api/documents/${d.document_id}/file`;
          return (
            <li key={d.document_id}>
              <button
                type="button"
                onClick={() => setPreview(d)}
                className="group flex w-full flex-col overflow-hidden rounded-lg border border-grid bg-surface text-left transition hover:border-accent hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                title={d.title}
              >
                <span className="relative aspect-square w-full bg-page">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={fileUrl}
                      alt={d.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                    />
                  ) : (
                    <span className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted">
                      {video ? "Video" : "File"}
                      <span className="max-w-full truncate normal-case tracking-normal text-muted/80">
                        {d.original_filename ?? d.title}
                      </span>
                    </span>
                  )}
                </span>
                <span className="truncate border-t border-grid px-1.5 py-1 text-[10px] font-medium text-ink">
                  {d.title}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {preview ? (
        <DocumentPreviewModal
          documentId={preview.document_id}
          fallbackTitle={preview.title}
          mimeType={preview.mime_type}
          filename={preview.original_filename}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </div>
  );
}
