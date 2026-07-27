// Middleware: two-tier auth routing (operator + client portal).
// AC-10 (issue #68): client sessions are restricted to /portal/*; operator
// sessions have full access except /portal/* (clients use /portal/login).

import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionRole } from "@/lib/auth";

const PUBLIC_PATHS = new Set([
  "/login",
  "/logout",
  "/api/login",
  "/api/wp/pairing/register",
  "/portal/login",
  "/api/portal/login",
]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (/^\/api\/wp\/connections\/\d+\/validate-login-token$/.test(pathname)) return true;
  if (/^\/api\/wp\/connections\/\d+\/health-report$/.test(pathname)) return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes: always allowed.
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Decode the session to get the role.
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = await verifySessionRole(token);

  const isPortalPath = pathname.startsWith("/portal") || pathname.startsWith("/api/portal");
  const isApi = pathname.startsWith("/api/");

  if (session?.role === "client") {
    // Clients can only access /portal/* and /api/portal/*.
    if (isPortalPath) {
      return NextResponse.next();
    }
    // Client trying to access operator routes → redirect to portal.
    if (isApi) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/portal", req.url));
  }

  if (session?.role === "admin" || session?.role === "operator") {
    // Operators (both legacy admin + new operator accounts) get dashboard access.
    if (isPortalPath) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // No valid session — redirect to the right login.
  if (isApi) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (isPortalPath) {
    const portalLogin = new URL("/portal/login", req.url);
    portalLogin.searchParams.set("next", pathname);
    return NextResponse.redirect(portalLogin);
  }
  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
