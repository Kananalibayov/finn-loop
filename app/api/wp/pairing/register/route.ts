// AC-4, AC-5 (issue #34): public endpoint for the WP plugin to register a connection.
// Accepts { code, siteUrl, username, appPassword }, validates the pairing code,
// creates a wp_connections row, and links it to the code. This endpoint is
// PUBLIC (not behind middleware) since it's called from the client's WP server.

import { NextRequest, NextResponse } from "next/server";
import {
  consumePairingCode,
  addWpConnection,
  linkPairingCode,
} from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Derive the WP REST API URL from the site URL. */
function deriveApiUrl(siteUrl: string): string {
  const trimmed = siteUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/wp-json")) return trimmed;
  return `${trimmed}/wp-json`;
}

export async function POST(req: NextRequest) {
  let body: { code?: string; siteUrl?: string; username?: string; appPassword?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { code, siteUrl, username, appPassword } = body ?? {};

  // Validate all fields present.
  if (!code?.trim() || !siteUrl?.trim() || !username?.trim() || !appPassword?.trim()) {
    return NextResponse.json(
      { error: "code, siteUrl, username, and appPassword are all required." },
      { status: 400 },
    );
  }

  // AC-4 step 1: consume the pairing code (one-time use, expiry-checked).
  const pairingRow = consumePairingCode(code.trim());
  if (!pairingRow) {
    return NextResponse.json(
      { error: "Invalid, already used, or expired pairing code." },
      { status: 404 },
    );
  }

  // AC-4 step 2-3: create the connection.
  // AC-2 (issue #62): generate a health_secret for plugin→platform reporting.
  const apiUrl = deriveApiUrl(siteUrl.trim());
  const healthSecret = randomHex32();
  const conn = addWpConnection({
    label: pairingRow.label,
    apiUrl,
    username: username.trim(),
    appPassword: appPassword.trim(),
    healthSecret,
  });

  // AC-4 step 4: link the pairing code to the connection.
  linkPairingCode(code.trim(), conn.id);

  return NextResponse.json(
    { ok: true, connectionId: conn.id, label: pairingRow.label, healthSecret },
    { status: 200 },
  );
}

/** 32-byte hex string for the health secret. */
function randomHex32(): string {
  const arr = new Uint8Array(32);
  globalThis.crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}
