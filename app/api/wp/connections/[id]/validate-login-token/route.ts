// AC-3 (issue #61): validate a login token — called by the WP plugin
// server-to-server during the SSO handshake. PUBLIC (not behind middleware)
// because the plugin has no platform session; the token itself is the
// credential. Single-use + 5-min TTL enforced in consumeLoginToken.

import { NextRequest, NextResponse } from "next/server";
import { consumeLoginToken } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });
  }

  let body: { token?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const token = body.token?.trim();
  if (!token) {
    return NextResponse.json({ ok: false, error: "token is required." }, { status: 400 });
  }

  const result = consumeLoginToken(num, token);
  if (!result) {
    return NextResponse.json(
      { ok: false, error: "Token is invalid, expired, or already used." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, username: result.username });
}
