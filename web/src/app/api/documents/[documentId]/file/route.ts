import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentStaff } from "@/lib/staff-server";
import { CASE_DOCUMENTS_BUCKET } from "@/lib/documents/enabled";

/**
 * Same-origin file stream for in-app preview (iframe/img).
 * Avoids Supabase CSP/frame blocks on signed URLs.
 */
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
      "document_id, title, storage_path, original_filename, mime_type, byte_size, deleted_at",
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
    return NextResponse.json({ error: "No file on this document" }, { status: 404 });
  }

  // Vercel serverless response limit ~4.5MB — large files open via signed redirect instead
  const byteSize = Number(doc.byte_size ?? 0);
  const maxInline = 4 * 1024 * 1024;
  const service = createServiceClient();
  if (!service) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY required" },
      { status: 503 },
    );
  }

  const logView = new URL(req.url).searchParams.get("log") !== "0";
  if (logView) {
    await supabase.schema("workflow").from("document_access_log").insert({
      document_id: documentId,
      staff_id: staff.staff_id,
      action: "view",
    });
  }

  if (byteSize > maxInline) {
    const { data: signed, error: sErr } = await service.storage
      .from(CASE_DOCUMENTS_BUCKET)
      .createSignedUrl(doc.storage_path as string, 120);
    if (sErr || !signed?.signedUrl) {
      return NextResponse.json(
        { error: sErr?.message || "Could not sign URL" },
        { status: 500 },
      );
    }
    return NextResponse.redirect(signed.signedUrl);
  }

  const { data: blob, error: dErr } = await service.storage
    .from(CASE_DOCUMENTS_BUCKET)
    .download(doc.storage_path as string);

  if (dErr || !blob) {
    return NextResponse.json(
      { error: dErr?.message || "Download failed" },
      { status: 500 },
    );
  }

  const bytes = Buffer.from(await blob.arrayBuffer());
  const filename = String(doc.original_filename || "document")
    .replace(/[^\w.\-()+ ]+/g, "_")
    .slice(0, 180);
  const mime =
    (doc.mime_type as string | null) ||
    (filename.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : "application/octet-stream");

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, no-store",
      // Allow this response to be framed by our own app (preview modal).
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Security-Policy": "frame-ancestors 'self'",
    },
  });
}
