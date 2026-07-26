// AC-3 (issue #62): health-report intake from the WP plugin.
// PUBLIC (validated by health_secret, not a platform session). The plugin
// pushes WP version, theme, plugin count, and a health score here periodically.

import { NextRequest, NextResponse } from "next/server";
import { verifyHealthSecret, saveWpConnectionHealth } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });
  }

  let body: {
    healthSecret?: string;
    wpVersion?: string;
    themeName?: string;
    pluginCount?: number;
    healthScore?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const secret = body.healthSecret?.trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "healthSecret is required." }, { status: 400 });
  }

  // Validate the health_secret (constant-time comparison in the helper).
  if (!verifyHealthSecret(num, secret)) {
    return NextResponse.json({ ok: false, error: "Invalid health secret." }, { status: 403 });
  }

  // Validate the health data shape — coerce to safe numbers.
  const wpVersion = body.wpVersion?.trim() ?? "";
  const themeName = body.themeName?.trim() ?? "";
  const pluginCount = typeof body.pluginCount === "number" && Number.isFinite(body.pluginCount)
    ? Math.floor(body.pluginCount) : 0;
  const rawScore = typeof body.healthScore === "number" && Number.isFinite(body.healthScore)
    ? body.healthScore : 0;
  const healthScore = Math.max(0, Math.min(10, Math.floor(rawScore)));

  if (!wpVersion) {
    return NextResponse.json({ ok: false, error: "wpVersion is required." }, { status: 400 });
  }

  saveWpConnectionHealth(num, { wpVersion, themeName, pluginCount, healthScore });

  return NextResponse.json({ ok: true });
}
