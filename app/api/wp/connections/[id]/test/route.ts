// Test a connection using its already-stored credentials, keyed by id.
// The dashboard's connection cards only ever have a connection id (the safe
// API projection never returns app_password to the browser), so testing from
// a card must look up the password server-side instead of requiring the
// client to resend it — mirrors login-token/sync-settings/health-report.

import { NextRequest, NextResponse } from "next/server";
import { getWpConnection } from "@/lib/db";
import { WpClient } from "@/lib/wp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const conn = getWpConnection(num);
  if (!conn) {
    return NextResponse.json({ error: "Connection not found." }, { status: 404 });
  }

  if (!conn.app_password) {
    return NextResponse.json({ ok: false, error: "No password stored for this connection." });
  }

  const client = new WpClient({
    apiUrl: conn.api_url,
    username: conn.username,
    appPassword: conn.app_password,
  });
  const result = await client.testConnection();

  return NextResponse.json(result, { status: 200 });
}
