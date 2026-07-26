// AC-4 (issue #32): WP connections list + create endpoints.
// AC-2 (issue #40): safeConnection now also exposes pairedViaCode (derived
// from the listWpConnections join). appPassword is still NEVER returned.
import { NextRequest, NextResponse } from "next/server";
import { listWpConnections, addWpConnection } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeConnection(c: {
  id: number;
  label: string;
  api_url: string;
  username: string;
  app_password: string;
  created_at: string;
  /** Absent for freshly-inserted rows (addWpConnection return); defaults to 0. */
  paired_via_code?: number;
  /** AC-4 (issue #62): health fields — null until first report. */
  wp_version?: string | null;
  theme_name?: string | null;
  plugin_count?: number | null;
  health_score?: number | null;
  health_reported_at?: string | null;
}) {
  return {
    id: c.id,
    label: c.label,
    apiUrl: c.api_url,
    username: c.username,
    hasPassword: Boolean(c.app_password),
    createdAt: c.created_at,
    pairedViaCode: (c.paired_via_code ?? 0) > 0,
    // AC-4 (issue #62): health projection. health_secret is NEVER returned.
    wpVersion: c.wp_version ?? null,
    themeName: c.theme_name ?? null,
    pluginCount: c.plugin_count ?? null,
    healthScore: c.health_score ?? null,
    healthReportedAt: c.health_reported_at ?? null,
  };
}

export async function GET() {
  const rows = listWpConnections();
  return NextResponse.json(rows.map(safeConnection));
}

export async function POST(req: NextRequest) {
  let body: { label?: string; apiUrl?: string; username?: string; appPassword?: string };
  try { body = (await req.json()) as typeof body; } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const { label, apiUrl, username, appPassword } = body ?? {};
  if (!label?.trim() || !apiUrl?.trim() || !username?.trim() || !appPassword?.trim()) {
    return NextResponse.json({ error: "label, apiUrl, username, and appPassword are all required." }, { status: 400 });
  }
  const row = addWpConnection({ label: label.trim(), apiUrl: apiUrl.trim(), username: username.trim(), appPassword: appPassword.trim() });
  return NextResponse.json(safeConnection(row), { status: 201 });
}
