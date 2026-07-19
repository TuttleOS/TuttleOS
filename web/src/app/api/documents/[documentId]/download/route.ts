import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentStaff } from "@/lib/staff-server";
import {
  CASE_DOCUMENTS_BUCKET,
} from "@/lib/documents/enabled";

export async function GET(
  req: Request,
  { params }: { params: { documentId: string } },
) {
  const staff = await getCurrentStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const documentId = params.documentId;
  if (!documentId) {
    return NextResponse.json({ error: "Missing document id" }, { status: 400 });
  }

  const supabase = createClient();
  const { data: doc, error } = await supabase
    .schema("workflow")
    .from("document")
    .select(
      "document_id, title, storage_path, original_filename, mime_type, deleted_at",
    )
    .eq("document_id", documentId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!doc || doc.deleted_at) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!doc.storage_path) {
    return NextResponse.json(
      { error: "No file on this document (metadata / Dropbox only)" },
      { status: 404 },
    );
  }

  const service = createServiceClient();
  if (!service) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY required for download" },
      { status: 503 },
    );
  }

  const { data: signed, error: sErr } = await service.storage
    .from(CASE_DOCUMENTS_BUCKET)
    .createSignedUrl(doc.storage_path as string, 120);

  if (sErr || !signed?.signedUrl) {
    return NextResponse.json(
      { error: sErr?.message || "Could not sign download URL" },
      { status: 500 },
    );
  }

  const action =
    new URL(req.url).searchParams.get("action") === "view"
      ? "view"
      : "download";

  await supabase.schema("workflow").from("document_access_log").insert({
    document_id: documentId,
    staff_id: staff.staff_id,
    action,
  });

  // Prefer redirect so large files never stream through the Next.js function.
  return NextResponse.redirect(signed.signedUrl);
}
