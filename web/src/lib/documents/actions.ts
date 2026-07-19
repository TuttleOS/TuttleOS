"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStaff } from "@/lib/staff-server";
import {
  FILING_DOC_TYPES,
  isRestrictedCategory,
  statusForUpload,
} from "./types";

export type ActionResult =
  | { ok: true; message?: string; documentId?: string }
  | { ok: false; error: string };

async function requireStaff() {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("Not signed in or staff not linked");
  return staff;
}

function assertDocumentsOn(): ActionResult | null {
  // uploads are enabled; keep helper for a future hard-off switch
  return null;
}

/** Intake may not create restricted category rows (app layer; mirrors RLS read). */
export async function intakeBlockedFromType(
  docTypeCode: string,
): Promise<boolean> {
  const staff = await getCurrentStaff();
  if (!staff) return true;
  if (staff.is_attorney || staff.role_code !== "intake") return false;
  const supabase = createClient();
  const { data } = await supabase
    .schema("ref")
    .from("document_type")
    .select("category")
    .eq("code", docTypeCode)
    .maybeSingle();
  return isRestrictedCategory(data?.category ?? null);
}

export async function completeDocumentUploadAction(input: {
  documentId: string;
  matterId: string;
  docTypeCode: string;
  title: string;
  eventDate: string;
  storagePath: string;
  mimeType: string | null;
  byteSize: number;
  originalFilename: string;
  notes?: string | null;
  batesStart?: string | null;
  batesEnd?: string | null;
  supersedesDocumentId?: string | null;
}): Promise<ActionResult> {
  const gated = assertDocumentsOn();
  if (gated) return gated;

  try {
    const staff = await requireStaff();
    if (await intakeBlockedFromType(input.docTypeCode)) {
      return {
        ok: false,
        error: "Intake cannot upload restricted document types.",
      };
    }

    const title = input.title.trim();
    if (!title) return { ok: false, error: "Title is required" };
    if (!input.eventDate) return { ok: false, error: "Date is required" };
    if (!input.storagePath || !input.documentId) {
      return { ok: false, error: "Missing upload path" };
    }

    const supabase = createClient();
    const status = statusForUpload(input.docTypeCode);
    const row: Record<string, unknown> = {
      document_id: input.documentId,
      entity_id: input.matterId,
      client_matter_id: input.matterId,
      doc_type_code: input.docTypeCode,
      title,
      direction: "inbound",
      status,
      received_date: input.eventDate,
      storage_path: input.storagePath,
      mime_type: input.mimeType,
      byte_size: input.byteSize,
      original_filename: input.originalFilename,
      uploaded_at: new Date().toISOString(),
      uploaded_by: staff.staff_id,
      owner_staff_id: staff.staff_id,
      supersedes_document_id: input.supersedesDocumentId || null,
      notes: input.notes?.trim() || null,
    };

    if (status === "executed") {
      row.executed_date = input.eventDate;
    }
    if (FILING_DOC_TYPES.has(input.docTypeCode)) {
      // filed / served date lives on received_date; status already "filed"
    }
    if (input.docTypeCode === "production") {
      row.bates_start = input.batesStart?.trim() || null;
      row.bates_end = input.batesEnd?.trim() || null;
    }

    const { error } = await supabase
      .schema("workflow")
      .from("document")
      .insert(row);
    if (error) return { ok: false, error: error.message };

    const action = input.supersedesDocumentId ? "replace" : "upload";
    await supabase.schema("workflow").from("document_access_log").insert({
      document_id: input.documentId,
      staff_id: staff.staff_id,
      action,
    });

    revalidatePath(`/cases/${input.matterId}`);
    return {
      ok: true,
      message: input.supersedesDocumentId
        ? "New version saved (original kept on record)"
        : "Document saved to case",
      documentId: input.documentId,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

export async function softDeleteDocumentAction(input: {
  documentId: string;
  matterId: string;
}): Promise<ActionResult> {
  const gated = assertDocumentsOn();
  if (gated) return gated;

  try {
    await requireStaff();
    const supabase = createClient();
    const { error } = await supabase
      .schema("workflow")
      .from("document")
      .update({ deleted_at: new Date().toISOString() })
      .eq("document_id", input.documentId)
      .eq("client_matter_id", input.matterId);
    if (error) return { ok: false, error: error.message };

    revalidatePath(`/cases/${input.matterId}`);
    return { ok: true, message: "Document soft-deleted" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}
