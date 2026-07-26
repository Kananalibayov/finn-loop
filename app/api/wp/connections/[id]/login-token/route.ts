// AC-2 (issue #61): generate a single-use SSO login token for a connection.
// Operator-only (behind middleware). Returns a login URL the operator's
// browser opens to be logged into the client's WP admin via the plugin.

import { NextRequest, NextResponse } from "next/server";
import { getWpConnection, createLoginToken } from "@/lib/db";

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

  const { token, expiresAt } = createLoginToken(num);

  // Derive the plugin's SSO endpoint URL from the connection's apiUrl.
  // apiUrl is like "https://host/wp-json" → origin is "https://host".
  const origin = conn.api_url.replace(/\/wp-json\/?$/, "");
  const loginUrl = `${origin}/wp-json/finn-loop/v1/sso?token=${encodeURIComponent(token)}`;

  return NextResponse.json({ loginUrl, expiresAt });
}
