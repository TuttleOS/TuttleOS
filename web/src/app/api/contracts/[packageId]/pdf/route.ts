import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStaff } from "@/lib/staff-server";

export async function GET(
  _req: Request,
  { params }: { params: { packageId: string } },
) {
  const staff = await getCurrentStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const packageId = params.packageId;
  if (!packageId) {
    return NextResponse.json({ error: "Missing package id" }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .schema("workflow")
    .from("contract_package")
    .select(
      "contract_package_id, status, client_display_names, artifact_pdf_base64, deleted_at",
    )
    .eq("contract_package_id", packageId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || data.deleted_at) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (data.status !== "executed" || !data.artifact_pdf_base64) {
    return NextResponse.json(
      { error: "Executed PDF not ready yet" },
      { status: 404 },
    );
  }

  const bytes = Buffer.from(data.artifact_pdf_base64 as string, "base64");
  const safeName = String(data.client_display_names || "contract")
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
