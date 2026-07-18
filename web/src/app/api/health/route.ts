import { NextResponse } from "next/server";

/** Non-PHI health check for uptime monitors. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "tuttle-os",
    time: new Date().toISOString(),
  });
}
