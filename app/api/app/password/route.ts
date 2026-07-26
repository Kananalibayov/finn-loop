// AC-9 (issue #46): change the admin password.
// POST { currentPassword, newPassword } — verifies current, sets new (bcrypt).
// Operator-only (behind middleware). newPassword must be >= 8 chars.

import { NextRequest, NextResponse } from "next/server";
import { verifyPasswordAgainstHash, hashPassword } from "@/lib/auth";
import { getAppSettings, saveAppSettings } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_LENGTH = 8;

export async function POST(req: NextRequest) {
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

  // AC-6 (issue #46): verify against DB override first, env fallback.
  const dbHash = getAppSettings()?.admin_password_hash ?? null;
  const envHash = process.env.ADMIN_PASSWORD_HASH ?? null;
  if (!verifyPasswordAgainstHash(currentPassword, [dbHash, envHash])) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
  }

  if (typeof newPassword !== "string" || newPassword.length < MIN_LENGTH) {
    return NextResponse.json(
      { error: `New password must be at least ${MIN_LENGTH} characters.` },
      { status: 400 },
    );
  }

  // Hash + store in the DB (env hash left as a fallback if DB is later cleared).
  saveAppSettings({ adminPasswordHash: hashPassword(newPassword) });
  return NextResponse.json({ ok: true });
}
