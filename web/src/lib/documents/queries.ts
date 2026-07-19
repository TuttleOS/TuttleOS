import { createClient } from "@/lib/supabase/server";
import { documentsEnabled } from "./enabled";
import {
  isRestrictedCategory,
  type AccessLogRow,
  type DocumentRow,
} from "./types";

/** Flat select only — PostgREST cannot embed cross-schema FKs (ref/core). */
const DOC_SELECT = `
  document_id, client_matter_id, doc_type_code, title, status, notes,
  received_date, executed_date, dropbox_path, storage_path, mime_type,
  byte_size, original_filename, uploaded_at, uploaded_by,
  supersedes_document_id, bates_prefix, bates_start, bates_end, created_at
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
      .order("created_at", { ascending: false });

    if (error) {
      console.error("listMatterDocuments:", error.message);
      return [];
    }

    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    if (rows.length === 0) return [];

    const typeCodes = [
      ...new Set(rows.map((r) => r.doc_type_code as string).filter(Boolean)),
    ];
    const uploaderIds = [
      ...new Set(
        rows
          .map((r) => r.uploaded_by as string | null)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const typeByCode = new Map<string, { label: string; category: string }>();
    if (typeCodes.length > 0) {
      const { data: types } = await supabase
        .schema("ref")
        .from("document_type")
        .select("code, label, category")
        .in("code", typeCodes);
      for (const t of types ?? []) {
        typeByCode.set(t.code as string, {
          label: t.label as string,
          category: (t.category as string) ?? "",
        });
      }
    }

    const nameByStaff = new Map<string, string>();
    if (uploaderIds.length > 0) {
      const { data: staffRows } = await supabase
        .schema("core")
        .from("staff")
        .select("staff_id, person:person_id(first_name, last_name)")
        .in("staff_id", uploaderIds);
      for (const s of staffRows ?? []) {
        const person = s.person as {
          first_name?: string;
          last_name?: string;
        } | null;
        const name = person
          ? `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim()
          : "";
        if (name) nameByStaff.set(s.staff_id as string, name);
      }
    }

    const supersededIds = new Set(
      rows
        .map((r) => r.supersedes_document_id as string | null)
        .filter((id): id is string => Boolean(id)),
    );
    const titleById = new Map(
      rows.map((r) => [r.document_id as string, r.title as string]),
    );

    // Prefer uploaded_at ordering in memory (nulls last)
    rows.sort((a, b) => {
      const ta = (a.uploaded_at as string | null) ?? (a.created_at as string);
      const tb = (b.uploaded_at as string | null) ?? (b.created_at as string);
      return tb.localeCompare(ta);
    });

    return rows.map((r) => {
      const code = r.doc_type_code as string;
      const meta = typeByCode.get(code);
      const cat = meta?.category ?? null;
      const sid = r.uploaded_by as string | null;
      const supersedesId = r.supersedes_document_id as string | null;
      return {
        document_id: r.document_id as string,
        client_matter_id: (r.client_matter_id as string | null) ?? null,
        doc_type_code: code,
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
        uploaded_by: sid,
        supersedes_document_id: supersedesId,
        notes: (r.notes as string | null) ?? null,
        bates_prefix: (r.bates_prefix as string | null) ?? null,
        bates_start: (r.bates_start as string | null) ?? null,
        bates_end: (r.bates_end as string | null) ?? null,
        created_at: r.created_at as string,
        type_label: meta?.label ?? code,
        type_category: cat,
        uploader_name: sid ? (nameByStaff.get(sid) ?? null) : null,
        supersedes_title: supersedesId
          ? (titleById.get(supersedesId) ?? null)
          : null,
        is_superseded: supersededIds.has(r.document_id as string),
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
      .select("access_id, document_id, staff_id, action, accessed_at")
      .in("document_id", docIds)
      .order("accessed_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("listMatterAccessLog:", error.message);
      return [];
    }

    const staffIds = [
      ...new Set(
        (data ?? [])
          .map((r) => r.staff_id as string)
          .filter(Boolean),
      ),
    ];
    const nameByStaff = new Map<string, string>();
    if (staffIds.length > 0) {
      const { data: staffRows } = await supabase
        .schema("core")
        .from("staff")
        .select("staff_id, person:person_id(first_name, last_name)")
        .in("staff_id", staffIds);
      for (const s of staffRows ?? []) {
        const person = s.person as {
          first_name?: string;
          last_name?: string;
        } | null;
        const name = person
          ? `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim()
          : "";
        if (name) nameByStaff.set(s.staff_id as string, name);
      }
    }

    return (data ?? []).map((r) => ({
      access_id: r.access_id as number,
      document_id: r.document_id as string,
      staff_id: r.staff_id as string,
      action: r.action as string,
      accessed_at: r.accessed_at as string,
      document_title: titleById.get(r.document_id as string) ?? null,
      staff_name: nameByStaff.get(r.staff_id as string) ?? null,
    }));
  } catch (e) {
    console.error("listMatterAccessLog:", e);
    return [];
  }
}
