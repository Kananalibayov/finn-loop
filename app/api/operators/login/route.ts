// AC-3 (issue #74): operator login. PUBLIC.
// With an email: authenticates ONLY the matching operator — an unknown email
// gets the same generic 401 as a wrong password and never falls through to the
// legacy admin path (issue #136). Without an email: the legacy single-admin
// path, gated by the retirement policy in legacyAdminCandidateHashes.
import { NextRequest, NextResponse } from "next/server";
import { getAppSettings, getOperatorByEmail, listOperators } from "@/lib/db";
import {
  legacyAdminCandidateHashes,
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

  // If email provided, authenticate ONLY the matching operator. A missing
  // operator or a wrong password gets the same generic 401 — never fall
  // through to the legacy admin path (issue #136, constraint 2).
  if (email) {
    const operator = getOperatorByEmail(email);
    if (operator && verifyPasswordAgainstHash(password, [operator.password_hash])) {
      const cookie = await createOperatorSessionCookie(operator.id, operator.role);
      return NextResponse.json(
        { redirect: "/" },
        { status: 200, headers: { "Set-Cookie": cookie } },
      );
    }
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  // Password-only legacy single-admin path (no email supplied).
  // Issue #136 (GAP-LEDGER §8.2): a stored DB hash is the sole candidate; the
  // env hash is accepted only during the zero-operator bootstrap window.
  const dbHash = getAppSettings()?.admin_password_hash ?? null;
  const envHash = process.env.ADMIN_PASSWORD_HASH ?? null;
  const candidates = legacyAdminCandidateHashes(dbHash, envHash, listOperators().length);
  if (verifyPasswordAgainstHash(password, candidates)) {
    const cookie = await createSessionCookie();
    return NextResponse.json(
      { redirect: "/" },
      { status: 200, headers: { "Set-Cookie": cookie } },
    );
  }

  return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
}
