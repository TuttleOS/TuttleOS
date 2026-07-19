import { createClient } from "@/lib/supabase/server";
import { documentsEnabled } from "./enabled";
import {
  isRestrictedCategory,
  type AccessLogRow,
  type DocumentRow,
} from "./types";

const DOC_SELECT = `
  document_id, client_matter_id, doc_type_code, title, status,
  received_date, executed_date, dropbox_path, storage_path, mime_type,
  byte_size, original_filename, uploaded_at, uploaded_by,
  supersedes_document_id, notes, bates_prefix, bates_start, bates_end, created_at,
  doc_type:doc_type_code(label, category),
  uploader:uploaded_by(person:person_id(first_name, last_name))
`;

export async function listMatterDocuments(
  matterId: string,
): Promise<DocumentRow[]> {
  if (!documentsEnabled()) return [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .schema("workflow")
      .from("document")
      .select(DOC_SELECT)
      .eq("client_matter_id", matterId)
      .is("deleted_at", null)
      .order("uploaded_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("listMatterDocuments:", error.message);
      return [];
    }

    const rows = (data ?? []) as unknown as Array<
      Record<string, unknown> & {
        document_id: string;
        supersedes_document_id: string | null;
        doc_type?: { label?: string; category?: string } | null;
        uploader?: {
          person?: { first_name?: string; last_name?: string } | null;
        } | null;
      }
    >;

    const supersededIds = new Set(
      rows
        .map((r) => r.supersedes_document_id)
        .filter((id): id is string => Boolean(id)),
    );

    const byId = new Map(rows.map((r) => [r.document_id, r]));

    return rows.map((r) => {
      const cat = r.doc_type?.category ?? null;
      const person = r.uploader?.person;
      const uploader_name = person
        ? `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() || null
        : null;
      const supersedes = r.supersedes_document_id
        ? byId.get(r.supersedes_document_id)
        : null;
      return {
        document_id: r.document_id,
        client_matter_id: (r.client_matter_id as string | null) ?? null,
        doc_type_code: r.doc_type_code as string,
        title: r.title as string,
        status: r.status as string,
        received_date: (r.received_date as string | null) ?? null,
        executed_date: (r.executed_date as string | null) ?? null,
        dropbox_path: (r.dropbox_path as string | null) ?? null,
        storage_path: (r.storage_path as string | null) ?? null,
        mime_type: (r.mime_type as string | null) ?? null,
        byte_size: (r.byte_size as number | null) ?? null,
        original_filename: (r.original_filename as string | null) ?? null,
        uploaded_at: (r.uploaded_at as string | null) ?? null,
        uploaded_by: (r.uploaded_by as string | null) ?? null,
        supersedes_document_id: r.supersedes_document_id,
        notes: (r.notes as string | null) ?? null,
        bates_prefix: (r.bates_prefix as string | null) ?? null,
        bates_start: (r.bates_start as string | null) ?? null,
        bates_end: (r.bates_end as string | null) ?? null,
        created_at: r.created_at as string,
        type_label: r.doc_type?.label ?? null,
        type_category: cat,
        uploader_name,
        supersedes_title: supersedes ? (supersedes.title as string) : null,
        is_superseded: supersededIds.has(r.document_id),
        restricted: isRestrictedCategory(cat),
      };
    });
  } catch (e) {
    console.error("listMatterDocuments:", e);
    return [];
  }
}

export async function listMatterAccessLog(
  matterId: string,
  limit = 40,
): Promise<AccessLogRow[]> {
  if (!documentsEnabled()) return [];
  try {
    const supabase = createClient();

    const { data: docs, error: dErr } = await supabase
      .schema("workflow")
      .from("document")
      .select("document_id, title")
      .eq("client_matter_id", matterId)
      .is("deleted_at", null);
    if (dErr) {
      console.error("listMatterAccessLog docs:", dErr.message);
      return [];
    }
    const docIds = (docs ?? []).map((d) => d.document_id as string);
    if (docIds.length === 0) return [];

    const titleById = new Map(
      (docs ?? []).map((d) => [d.document_id as string, d.title as string]),
    );

    const { data, error } = await supabase
      .schema("workflow")
      .from("document_access_log")
      .select(
        `access_id, document_id, staff_id, action, accessed_at,
         staff:staff_id(person:person_id(first_name, last_name))`,
      )
      .in("document_id", docIds)
      .order("accessed_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("listMatterAccessLog:", error.message);
      return [];
    }

    return (data ?? []).map((r) => {
      const staff = r.staff as {
        person?: { first_name?: string; last_name?: string } | null;
      } | null;
      const person = staff?.person;
      const staff_name = person
        ? `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() || null
        : null;
      return {
        access_id: r.access_id as number,
        document_id: r.document_id as string,
        staff_id: r.staff_id as string,
        action: r.action as string,
        accessed_at: r.accessed_at as string,
        document_title: titleById.get(r.document_id as string) ?? null,
        staff_name,
      };
    });
  } catch (e) {
    console.error("listMatterAccessLog:", e);
    return [];
  }
}
