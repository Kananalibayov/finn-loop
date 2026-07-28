// AC-4, AC-5 (issue #34): public endpoint for the WP plugin to register a connection.
// Accepts { code, siteUrl, username, appPassword }, validates the pairing code,
// creates a wp_connections row, and links it to the code. This endpoint is
// PUBLIC (not behind middleware) since it's called from the client's WP server.

import { NextRequest, NextResponse } from "next/server";
import {
  consumePairingCode,
  getPairingCode,
  addWpConnection,
  linkPairingCode,
} from "@/lib/db";
import { WpClient } from "@/lib/wp";
import { assertPublicHttpTarget, UnsafeTargetError } from "@/lib/net";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Derive the WP REST API URL from the site URL. */
function deriveApiUrl(siteUrl: string): string {
  const trimmed = siteUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/wp-json")) return trimmed;
  return `${trimmed}/wp-json`;
}

export async function POST(req: NextRequest) {
  // WP's wp_remote_post sometimes sends the body as form-encoded even when
  // Content-Type: application/json is set (some hosts/Plesk rewrite headers).
  // Accept both JSON and form-encoded bodies so pairing works either way.
  const contentType = req.headers.get("content-type") ?? "";
  const rawBody = await req.text();

  let body: { code?: string; siteUrl?: string; username?: string; appPassword?: string };
  if (contentType.includes("application/json")) {
    try {
      body = JSON.parse(rawBody) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
  } else {
    // Form-encoded fallback: parse URL-encoded pairs into an object.
    const params = new URLSearchParams(rawBody);
    body = {
      code: params.get("code") ?? undefined,
      siteUrl: params.get("siteUrl") ?? undefined,
      username: params.get("username") ?? undefined,
      appPassword: params.get("appPassword") ?? undefined,
    };
  }

  // Coerce to strings — defends against malformed JSON where a field arrives
  // as null/array/object instead of a string. Without this, .trim() throws
  // (TypeError: appPassword?.trim is not a function) and the route returns 500.
  const code = typeof body?.code === "string" ? body.code : "";
  const siteUrl = typeof body?.siteUrl === "string" ? body.siteUrl : "";
  const username = typeof body?.username === "string" ? body.username : "";
  // appPassword special case: some WP versions return the full Application
  // Password item object {uuid,password,...} instead of just the string.
  // Extract the .password field if we got the object form.
  let appPassword = "";
  if (typeof body?.appPassword === "string") {
    appPassword = body.appPassword;
  } else if (body?.appPassword && typeof body.appPassword === "object" && "password" in body.appPassword) {
    appPassword = String((body.appPassword as { password: unknown }).password ?? "");
  }

  // Validate all fields present.
  if (!code.trim() || !siteUrl.trim() || !username.trim() || !appPassword.trim()) {
    return NextResponse.json(
      { error: "code, siteUrl, username, and appPassword are all required." },
      { status: 400 },
    );
  }

  // This endpoint is PUBLIC, so the pairing code is the only credential —
  // check it BEFORE any outbound request. Peek without consuming, so a
  // verification failure below still leaves the code usable for a retry.
  // Ordering matters for security: fetching a caller-supplied URL before
  // establishing that the caller holds a valid code would turn this route
  // into an unauthenticated SSRF probe.
  const peeked = getPairingCode(code.trim());
  if (!peeked || peeked.used || new Date(peeked.expires_at) <= new Date()) {
    return NextResponse.json(
      { error: "Invalid, already used, or expired pairing code." },
      { status: 404 },
    );
  }

  // Reject non-public targets before fetching (defence in depth: the code
  // above is the auth gate, this stops a leaked code reaching internal hosts).
  let apiUrl: string;
  try {
    apiUrl = (await assertPublicHttpTarget(deriveApiUrl(siteUrl.trim()))).toString().replace(/\/+$/, "");
  } catch (e) {
    if (e instanceof UnsafeTargetError) {
      return NextResponse.json({ error: `Unusable siteUrl: ${e.message}` }, { status: 400 });
    }
    throw e;
  }

  // Verify the credentials actually work before creating a connection row.
  // Without this, a plugin bug that sends a malformed/hashed appPassword
  // (rather than the plaintext create_new_application_password() value)
  // silently registers a connection that will 401 on every future call.
  const verify = await new WpClient({
    apiUrl,
    username: username.trim(),
    appPassword: appPassword.trim(),
  }).testConnection();
  if (!verify.ok) {
    return NextResponse.json(
      { error: `Could not verify these credentials with WordPress: ${verify.error}` },
      { status: 502 },
    );
  }

  // AC-4 step 1: now consume the code (atomic, race-free, expiry-checked).
  const pairingRow = consumePairingCode(code.trim());
  if (!pairingRow) {
    return NextResponse.json(
      { error: "Invalid, already used, or expired pairing code." },
      { status: 404 },
    );
  }

  // AC-4 step 2-3: create the connection.
  // AC-2 (issue #62): generate a health_secret for plugin→platform reporting.
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
