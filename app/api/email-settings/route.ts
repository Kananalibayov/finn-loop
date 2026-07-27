// Email settings: GET (safe) + PUT (update). Operator-only.
import { NextRequest, NextResponse } from "next/server";
import { getAppSettings, saveEmailSettings } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = getAppSettings() as Record<string, string> | null;
  return NextResponse.json({
    smtpHost: s?.smtp_host ?? "",
    smtpPort: s?.smtp_port ?? "587",
    smtpUser: s?.smtp_user ?? "",
    smtpFrom: s?.smtp_from ?? "",
    hasPassword: Boolean(s?.smtp_pass),
    notifyOperatorEmail: s?.notify_operator_email ?? "",
  });
}

export async function PUT(req: NextRequest) {
  let body: {
    smtpHost?: string;
    smtpPort?: string;
    smtpUser?: string;
    smtpPass?: string;
    smtpFrom?: string;
    notifyOperatorEmail?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  saveEmailSettings({
    smtpHost: body.smtpHost?.trim(),
    smtpPort: body.smtpPort?.trim(),
    smtpUser: body.smtpUser?.trim(),
    smtpPass: body.smtpPass,
    smtpFrom: body.smtpFrom?.trim(),
    notifyOperatorEmail: body.notifyOperatorEmail?.trim(),
  });

  return NextResponse.json({ ok: true });
}
