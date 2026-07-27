// Plesk settings: GET (safe) + PUT (update). Operator-only.
import { NextRequest, NextResponse } from "next/server";
import { getAppSettings, savePleskSettings } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = getAppSettings();
  return NextResponse.json({
    pleskUrl: s?.plesk_url ?? "",
    pleskUser: s?.plesk_user ?? "",
    hasPassword: Boolean(s?.plesk_password),
  });
}

export async function PUT(req: NextRequest) {
  let body: { pleskUrl?: string; pleskUser?: string; pleskPassword?: string };
  try { body = (await req.json()) as typeof body; } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  savePleskSettings({
    pleskUrl: body.pleskUrl?.trim(),
    pleskUser: body.pleskUser?.trim(),
    pleskPassword: body.pleskPassword,
  });
  return NextResponse.json({ ok: true });
}
