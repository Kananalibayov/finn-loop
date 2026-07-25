// AC-4 (issue #32): WP connections list + create endpoints.

import { NextRequest, NextResponse } from "next/server";
import { listWpConnections, addWpConnection } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Safe projection — never expose app_password. */
function safeConnection(c: { id: number; label: string; api_url: string; username: string; app_password: string; created_at: string }) {
  return {
    id: c.id,
    label: c.label,
    apiUrl: c.api_url,
    username: c.username,
    hasPassword: Boolean(c.app_password),
    createdAt: c.created_at,
  };
}

/** GET: list all connections (safe shape). */
export async function GET() {
  const rows = listWpConnections();
  return NextResponse.json(rows.map(safeConnection));
}

/** POST: create a new connection. */
export async function POST(req: NextRequest) {
  let body: { label?: string; apiUrl?: string; username?: string; appPassword?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { label, apiUrl, username, appPassword } = body ?? {};
  if (!label?.trim() || !apiUrl?.trim() || !username?.trim() || !appPassword?.trim()) {
    return NextResponse.json(
      { error: "label, apiUrl, username, and appPassword are all required." },
      { status: 400 },
    );
  }

  const row = addWpConnection({
    label: label.trim(),
    apiUrl: apiUrl.trim(),
    username: username.trim(),
    appPassword: appPassword.trim(),
  });
  return NextResponse.json(safeConnection(row), { status: 201 });
}
