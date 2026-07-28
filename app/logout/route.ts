// AC-5 (issue #6): clear the session cookie and redirect to /login.
// Issue #95: POST-only. A state-changing GET here is a forced-logout CSRF —
// any page the operator visits could navigate them to /logout and destroy
// their session. GET is intentionally NOT exported, so Next.js returns 405.

import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";

export const runtime = "nodejs";

export function POST() {
  const cleared = `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
  return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_URL || "http://localhost:3000"), {
    status: 303,
    headers: { "Set-Cookie": cleared },
  });
}
