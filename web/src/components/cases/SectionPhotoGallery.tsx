"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DocumentPreviewModal } from "@/components/cases/DocumentPreviewModal";
import { softDeleteDocumentAction } from "@/lib/documents/actions";
import type { DocumentRow } from "@/lib/documents/types";
import { parsePdVehicleId } from "@/lib/cases/pdVehicle";

function isImage(mime: string | null, filename: string | null): boolean {
  if (mime?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(filename ?? "");
}

function isVideo(mime: string | null, filename: string | null): boolean {
  if (mime?.startsWith("video/")) return true;
  return /\.(mp4|mov|webm|m4v)$/i.test(filename ?? "");
}

function isPdf(mime: string | null, filename: string | null): boolean {
  if (mime === "application/pdf") return true;
  return /\.pdf$/i.test(filename ?? "");
}

/**
 * Thumbnail strip for section uploads (e.g. PD photos, records/bills).
 * Click opens the shared document lightbox (images + PDFs).
 * Optional vehicleId filters to photos tagged to that vehicle.
 */
export function SectionPhotoGallery({
  documents,
  docTypeCode = "photos_video",
  docTypeCodes,
  heading = "Uploaded photos",
  vehicleId,
  includeUntagged = false,
  matterId,
  canDelete = false,
}: {
  documents: DocumentRow[];
  /** Single type (default). Ignored when docTypeCodes is set. */
  docTypeCode?: string;
  /** Multiple types (e.g. medical_records + medical_bills). */
  docTypeCodes?: string[];
  heading?: string;
  /** When set, only docs tagged to this vehicle (plus untagged if includeUntagged). */
  vehicleId?: string | null;
  includeUntagged?: boolean;
  /** Required for Remove (soft-delete). */
  matterId?: string;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [preview, setPreview] = useState<DocumentRow | null>(null);
  const [pending, start] = useTransition();

  const typeSet = useMemo(() => {
    const list = docTypeCodes?.length ? docTypeCodes : [docTypeCode];
    return new Set(list);
  }, [docTypeCode, docTypeCodes]);

  const items = useMemo(() => {
    return documents.filter((d) => {
      if (!typeSet.has(d.doc_type_code)) return false;
      if (!d.storage_path || d.is_superseded) return false;
      if (!vehicleId) return true;
      const tagged = parsePdVehicleId(d.notes);
      if (tagged === vehicleId) return true;
      if (includeUntagged && !tagged) return true;
      return false;
    });
  }, [documents, typeSet, vehicleId, includeUntagged]);

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
          const pdf = isPdf(d.mime_type, d.original_filename);
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
                      {pdf ? "PDF" : video ? "Video" : "File"}
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
          deletePending={pending}
          onDelete={
            canDelete && matterId
              ? () => {
                  if (
                    !confirm(
                      "Remove this file from the case? It is hidden, not permanently wiped.",
                    )
                  ) {
                    return;
                  }
                  const id = preview.document_id;
                  start(async () => {
                    const res = await softDeleteDocumentAction({
                      documentId: id,
                      matterId,
                    });
                    if (res.ok) {
                      setPreview(null);
                      router.refresh();
                    }
                  });
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
