// AC-2 (issue #63): push settings to the WP plugin's REST endpoint.
// Operator-only. Uses the connection's stored Application Password for auth.
// Issue #100 (GAP-LEDGER §8.1): editor-or-above — writes to the client's live
// site (e.g. blog_public:0 silently de-indexes it from search engines).

import { NextRequest, NextResponse } from "next/server";
import { getWpConnection } from "@/lib/db";
import { wpFetch } from "@/lib/wp";
import { COOKIE_NAME, requireRole } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireRole(req.cookies.get(COOKIE_NAME)?.value, "editor");
  if (!session) {
    return NextResponse.json({ error: "Editor access or above required." }, { status: 403 });
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

  let body: { settings?: Record<string, string | boolean | number> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const settings = body.settings;
  if (!settings || typeof settings !== "object") {
    return NextResponse.json({ error: "settings object is required." }, { status: 400 });
  }

  // Call the plugin's PATCH endpoint using the stored creds.
  try {
    const res = await wpFetch(
      { apiUrl: conn.api_url, username: conn.username, appPassword: conn.app_password },
      "/finn-loop/v1/settings",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      },
    );
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: (data as { message?: string })?.message || `Plugin returned HTTP ${res.status}` },
        { status: 502 },
      );
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: `Could not reach the plugin: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
