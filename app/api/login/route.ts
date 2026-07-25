// AC-2, AC-3 (issue #6): login POST handler.
// Verifies password against ADMIN_PASSWORD_HASH; on success sets the signed
// http-only session cookie and returns a JSON redirect target.
// Lives at /api/login so it doesn't collide with /login (the page) — see
// middleware PUBLIC_PATHS for the exemption that lets unauthenticated users
// reach this endpoint.

import { NextRequest, NextResponse } from "next/server";
import { createSessionCookie, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Same-origin redirect targets only — never redirect off-site.
function safeNext(next: string | null | undefined): string {
  if (!next || typeof next !== "string") return "/";
  // Must start with "/" and not "//" (protocol-relative off-site).
  if (next.startsWith("/") && !next.startsWith("//")) return next;
  return "/";
}

export async function POST(req: NextRequest) {
  let body: { password?: string; next?: string };
  try {
    body = (await req.json()) as { password?: string; next?: string };
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const password = body?.password ?? "";
  const ok = verifyPassword(password);
  if (!ok) {
    // Generic error — never reveal whether the hash was missing vs. wrong pw.
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const redirect = safeNext(body?.next);
  const cookie = await createSessionCookie();
  return NextResponse.json(
    { redirect },
    { status: 200, headers: { "Set-Cookie": cookie } },
  );
}
