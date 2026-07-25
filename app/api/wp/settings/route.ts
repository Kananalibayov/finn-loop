// AC-3, AC-4 (issue #24): WP settings endpoints.
// GET  — returns { apiUrl, username, hasPassword } (never the password itself).
// PUT  — accepts { apiUrl, username, appPassword }, validates, upserts the
//        single wp_settings row, returns the same safe shape.

import { NextRequest, NextResponse } from "next/server";
import { getWpSettings, saveWpSettings } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** AC-3, AC-4: the safe projection of settings — password is a boolean only. */
function safeShape(row: { api_url: string; username: string; app_password: string } | null) {
  if (!row) return { apiUrl: "", username: "", hasPassword: false };
  return {
    apiUrl: row.api_url,
    username: row.username,
    hasPassword: Boolean(row.app_password),
  };
}

/** AC-3: GET — return settings without ever exposing the password. */
export async function GET() {
  const row = getWpSettings();
  return NextResponse.json(safeShape(row));
}

/** AC-4: PUT — validate + save, return the safe shape (no password echo). */
export async function PUT(req: NextRequest) {
  let body: { apiUrl?: string; username?: string; appPassword?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { apiUrl, username, appPassword } = body ?? {};
  if (!apiUrl?.trim() || !username?.trim() || !appPassword?.trim()) {
    return NextResponse.json(
      { error: "apiUrl, username, and appPassword are all required." },
      { status: 400 },
    );
  }

  const row = saveWpSettings({
    apiUrl: apiUrl.trim(),
    username: username.trim(),
    appPassword: appPassword.trim(),
  });
  return NextResponse.json(safeShape(row));
}
