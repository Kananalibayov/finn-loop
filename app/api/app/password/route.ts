// AC-9 (issue #46): change the admin password.
// POST { currentPassword, newPassword } — verifies current, sets new (bcrypt).
// Operator-only (behind middleware). newPassword must be >= 8 chars.

import { NextRequest, NextResponse } from "next/server";
import {
  legacyAdminCandidateHashes,
  verifyPasswordAgainstHash,
  hashPassword,
  COOKIE_NAME,
  requireRole,
} from "@/lib/auth";
import { getAppSettings, listOperators, saveAppSettings } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_LENGTH = 8;

export async function POST(req: NextRequest) {
  // Issue #100 (GAP-LEDGER §8.1): admin-only — changes the platform admin password.
  const session = await requireRole(req.cookies.get(COOKIE_NAME)?.value, "admin");
  if (!session) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { currentPassword, newPassword } = body ?? {};

  if (typeof currentPassword !== "string" || !currentPassword) {
    return NextResponse.json({ error: "currentPassword is required." }, { status: 400 });
  }

  // Issue #136 (GAP-LEDGER §8.2): a stored DB hash is the sole candidate; the
  // env hash is accepted only during the zero-operator bootstrap window.
  const dbHash = getAppSettings()?.admin_password_hash ?? null;
  const envHash = process.env.ADMIN_PASSWORD_HASH ?? null;
  const candidates = legacyAdminCandidateHashes(dbHash, envHash, listOperators().length);
  if (!verifyPasswordAgainstHash(currentPassword, candidates)) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
  }

  if (typeof newPassword !== "string" || newPassword.length < MIN_LENGTH) {
    return NextResponse.json(
      { error: `New password must be at least ${MIN_LENGTH} characters.` },
      { status: 400 },
    );
  }

  // Hash + store in the DB. Storing the DB hash is the durable retirement
  // marker (issue #136): from this point on the environment credential is no
  // longer accepted anywhere — there is no env fallback left to clear.
  saveAppSettings({ adminPasswordHash: hashPassword(newPassword) });
  return NextResponse.json({ ok: true });
}
