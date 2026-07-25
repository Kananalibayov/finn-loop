// AC-3 (issue #34): generate a pairing code (operator-only, behind middleware).

import { NextRequest, NextResponse } from "next/server";
import { createPairingCode } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { label?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { label } = body ?? {};
  if (!label?.trim()) {
    return NextResponse.json({ error: "A client label is required." }, { status: 400 });
  }

  const row = createPairingCode(label.trim());
  return NextResponse.json(
    { code: row.code, label: row.label, expiresAt: row.expires_at },
    { status: 201 },
  );
}
