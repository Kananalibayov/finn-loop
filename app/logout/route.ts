// AC-5 (issue #6): clear the session cookie and redirect to /login.

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

// Also accept GET for simple <a href="/logout"> links if used later.
export const GET = POST;
