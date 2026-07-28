// AC-2 (issue #61): generate a single-use SSO login token for a connection.
// Operator-only (behind middleware). Returns a login URL the operator's
// browser opens to be logged into the client's WP admin via the plugin.
// Issue #100 (GAP-LEDGER §8.1): admin-only + activity-logged — this endpoint
// mints WordPress administrator on a client's production site.

import { NextRequest, NextResponse } from "next/server";
import { getWpConnection, createLoginToken, logActivity } from "@/lib/db";
import { COOKIE_NAME, requireRole } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireRole(req.cookies.get(COOKIE_NAME)?.value, "admin");
  if (!session) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

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

  // The most sensitive action in the product must not be the one unlogged one.
  // NOTE: legacy role:"admin" sessions carry no operatorId — those events log
  // unattributed until legacy-session retirement (GAP-LEDGER §8.2) lands.
  logActivity({
    eventType: "wp_sso",
    description: `SSO login token minted for WP connection ${num} (${conn.label})`,
    operatorId: session.operatorId ?? null,
    connectionId: num,
  });

  // Derive the plugin's SSO endpoint URL from the connection's apiUrl.
  // apiUrl is like "https://host/wp-json" → origin is "https://host".
  const origin = conn.api_url.replace(/\/wp-json\/?$/, "");
  const loginUrl = `${origin}/wp-json/finn-loop/v1/sso?token=${encodeURIComponent(token)}`;

  return NextResponse.json({ loginUrl, expiresAt });
}
