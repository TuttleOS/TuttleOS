import { NextResponse } from "next/server";
import { getPublicContractByToken } from "@/lib/contracts/actions";

export async function GET(
  _req: Request,
  { params }: { params: { token: string } },
) {
  const token = params.token;
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const loaded = await getPublicContractByToken(token);
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: 404 });
  }

  const pkg = loaded.package;
  const pdf = pkg.artifact_pdf_base64;
  if (
    String(pkg.status) !== "executed" ||
    typeof pdf !== "string" ||
    pdf.length < 100
  ) {
    return NextResponse.json(
      { error: "Executed PDF not ready yet" },
      { status: 404 },
    );
  }

  const bytes = Buffer.from(pdf, "base64");
  const safeName = String(pkg.client_display_names || "contract")
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
