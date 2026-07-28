// AC-7, AC-8 (issue #46): app-level settings (OpenAI key + generation model).
// GET returns a SAFE projection (never the raw key); PUT updates overrides.
// Operator-only (behind middleware). The admin password has its own endpoint.

import { NextRequest, NextResponse } from "next/server";
import {
  getAppSettings,
  saveAppSettings,
  getEffectiveGenerationModel,
} from "@/lib/db";
import { COOKIE_NAME, requireRole } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** AC-7: safe projection — key presence + masked tail, model, source flags.
 *  Never returns the raw key or any password hash. */
function safeProjection() {
  const row = getAppSettings();
  const dbKey = row?.openai_api_key ?? "";
  const dbModel = row?.generation_model ?? "";
  const envKey = process.env.OPENAI_API_KEY ?? "";
  const envModel = process.env.OPENAI_MODEL ?? "";
  // Mask: show the last 4 chars of whichever source is in effect.
  const effectiveKey = dbKey || envKey;
  const masked = effectiveKey ? `…${effectiveKey.slice(-4)}` : null;
  return {
    openaiApiKeySet: Boolean(effectiveKey),
    openaiKeyMasked: masked,
    openaiKeySource: dbKey ? "db" : envKey ? "env" : "none",
    generationModel: getEffectiveGenerationModel(),
    generationModelSource: dbModel ? "db" : envModel ? "env" : "default",
    adminPasswordSet: Boolean(row?.admin_password_hash),
  };
}

export async function GET() {
  return NextResponse.json(safeProjection());
}

export async function PUT(req: NextRequest) {
  // Issue #100 (GAP-LEDGER §8.1): admin-only — writes platform config incl. the
  // OpenAI key. GET stays open to any operator role (safe projection only).
  const session = await requireRole(req.cookies.get(COOKIE_NAME)?.value, "admin");
  if (!session) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  let body: { openaiApiKey?: string; generationModel?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const patch: { openaiApiKey?: string; generationModel?: string } = {};
  // Only update fields that are actually present in the body (partial update).
  // Empty string is meaningful — it clears the DB override (revert to env).
  if (Object.prototype.hasOwnProperty.call(body, "openaiApiKey")) {
    if (typeof body.openaiApiKey !== "string") {
      return NextResponse.json({ error: "openaiApiKey must be a string." }, { status: 400 });
    }
    patch.openaiApiKey = body.openaiApiKey.trim();
  }
  if (Object.prototype.hasOwnProperty.call(body, "generationModel")) {
    if (typeof body.generationModel !== "string") {
      return NextResponse.json({ error: "generationModel must be a string." }, { status: 400 });
    }
    patch.generationModel = body.generationModel.trim();
  }

  saveAppSettings(patch);
  return NextResponse.json(safeProjection());
}
