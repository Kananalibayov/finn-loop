// AC-4, AC-6 (issue #6): protect app + API routes behind admin auth.
// Unauthenticated HTML requests redirect to /login; unauthenticated API
// requests get 401 JSON. /login and /logout are always public. Static assets
// are skipped via the default matcher exclusion (_next/static, _next/image,
// favicon).

import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySession } from "@/lib/auth";

const PUBLIC_PATHS = new Set(["/login", "/logout", "/api/login", "/api/wp/pairing/register"]);

/** AC-3 (issue #61): the validate-login-token endpoint has a dynamic [id]
 *  segment, so it can't go in PUBLIC_PATHS (exact-match). Match by prefix. */
function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  // /api/wp/connections/<id>/validate-login-token — plugin calls this server-side.
  if (/^\/api\/wp\/connections\/\d+\/validate-login-token$/.test(pathname)) return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes: always allowed.
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Verify the session cookie; fail closed if invalid.
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const ok = await verifySession(token);
  if (ok) {
    return NextResponse.next();
  }

  // API routes get 401 JSON; everything else redirects to /login.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Protect everything except static assets and the login/logout routes
  // (those are handled inside the middleware via PUBLIC_PATHS).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
