import { NextResponse } from "next/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";

export async function GET(
  _req: Request,
  { params }: { params: { token: string } },
) {
  const token = params.token;
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    return NextResponse.json({ error: "Signing unavailable" }, { status: 503 });
  }

  const supabase = createSupabaseJsClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc(
    "get_executed_contract_pdf_public",
    { p_token: token },
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  const payload = data as {
    ok?: boolean;
    error?: string;
    artifact_pdf_base64?: string;
    client_display_names?: string;
  } | null;
  if (!payload || payload.ok === false) {
    return NextResponse.json(
      { error: payload?.error || "Executed PDF not ready yet" },
      { status: 404 },
    );
  }

  const pdf = payload.artifact_pdf_base64;
  if (typeof pdf !== "string" || pdf.length < 100) {
    return NextResponse.json(
      { error: "Executed PDF not ready yet" },
      { status: 404 },
    );
  }

  const bytes = Buffer.from(pdf, "base64");
  const safeName = String(payload.client_display_names || "contract")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(0, 60);
  const filename = `contingent-fee-contract-${safeName}.pdf`;

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
