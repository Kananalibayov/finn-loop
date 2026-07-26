// AC-3 (issue #63): read current WP settings from the plugin.
// Operator-only. Proxies GET to the plugin's /finn-loop/v1/settings endpoint.

import { NextRequest, NextResponse } from "next/server";
import { getWpConnection } from "@/lib/db";
import { wpFetch } from "@/lib/wp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
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

  try {
    const res = await wpFetch(
      { apiUrl: conn.api_url, username: conn.username, appPassword: conn.app_password },
      "/finn-loop/v1/settings",
      { method: "GET" },
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
