import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentStaff } from "@/lib/staff-server";
import {
  CASE_DOCUMENTS_BUCKET,
  MAX_UPLOAD_BYTES,
} from "@/lib/documents/enabled";
import { intakeBlockedFromType } from "@/lib/documents/actions";
import { sanitizeFilename } from "@/lib/documents/types";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  // Storage uploads are live (sql/16). Feature flag only hides UI panels.
  const staff = await getCurrentStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    matterId?: string;
    filename?: string;
    mimeType?: string | null;
    byteSize?: number;
    docTypeCode?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const matterId = body.matterId?.trim();
  const filename = body.filename?.trim();
  const docTypeCode = body.docTypeCode?.trim();
  const byteSize = Number(body.byteSize ?? 0);

  if (!matterId || !filename || !docTypeCode) {
    return NextResponse.json(
      { error: "matterId, filename, and docTypeCode are required" },
      { status: 400 },
    );
  }
  if (!Number.isFinite(byteSize) || byteSize <= 0) {
    return NextResponse.json({ error: "Invalid file size" }, { status: 400 });
  }
  if (byteSize > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File exceeds ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB limit` },
      { status: 400 },
    );
  }

  if (await intakeBlockedFromType(docTypeCode)) {
    return NextResponse.json(
      { error: "Intake cannot upload restricted document types" },
      { status: 403 },
    );
  }

  const supabase = createClient();
  const { data: matter, error: mErr } = await supabase
    .schema("core")
    .from("client_matter")
    .select("client_matter_id")
    .eq("client_matter_id", matterId)
    .is("deleted_at", null)
    .maybeSingle();
  if (mErr) {
    return NextResponse.json({ error: mErr.message }, { status: 500 });
  }
  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }

  const service = createServiceClient();
  if (!service) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY is required for document upload (signed URL).",
      },
      { status: 503 },
    );
  }

  const documentId = randomUUID();
  const safe = sanitizeFilename(filename);
  const storagePath = `${matterId}/${documentId}/${safe}`;

  const { data, error } = await service.storage
    .from(CASE_DOCUMENTS_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          `Could not create upload URL. Create the "${CASE_DOCUMENTS_BUCKET}" bucket in Supabase Storage (see sql/16 comments).`,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    documentId,
    storagePath,
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
    mimeType: body.mimeType ?? null,
  });
}
