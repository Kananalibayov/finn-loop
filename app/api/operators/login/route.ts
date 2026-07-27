// AC-3 (issue #74): operator login. PUBLIC.
// Tries operator email+password first, then falls back to legacy single-admin.
import { NextRequest, NextResponse } from "next/server";
import { getOperatorByEmail } from "@/lib/db";
import {
  verifyPasswordAgainstHash,
  createOperatorSessionCookie,
  createSessionCookie,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const email = body.email?.trim();
  const password = body.password ?? "";

  if (!password) {
    return NextResponse.json({ error: "Password is required." }, { status: 400 });
  }

  // If email provided, try operator login.
  if (email) {
    const operator = getOperatorByEmail(email);
    if (operator) {
      if (verifyPasswordAgainstHash(password, [operator.password_hash])) {
        const cookie = await createOperatorSessionCookie(operator.id, operator.role);
        return NextResponse.json(
          { redirect: "/" },
          { status: 200, headers: { "Set-Cookie": cookie } },
        );
      }
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }
    // Email didn't match an operator — fall through to legacy admin below.
  }

  // Legacy single-admin fallback (no email, or email didn't match).
  const { getAppSettings } = await import("@/lib/db");
  const dbHash = getAppSettings()?.admin_password_hash ?? null;
  const envHash = process.env.ADMIN_PASSWORD_HASH ?? null;
  if (verifyPasswordAgainstHash(password, [dbHash, envHash])) {
    const cookie = await createSessionCookie();
    return NextResponse.json(
      { redirect: "/" },
      { status: 200, headers: { "Set-Cookie": cookie } },
    );
  }

  return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
}
