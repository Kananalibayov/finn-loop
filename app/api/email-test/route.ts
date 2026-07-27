// Test email: send a test to verify SMTP config. Operator-only.
import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { to?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const to = body.to?.trim();
  if (!to) {
    return NextResponse.json({ error: "Recipient email is required." }, { status: 400 });
  }

  const ok = await sendEmail({
    to,
    subject: "Test email from your agency platform",
    text: "If you received this, your SMTP settings are working correctly.",
    html: "<p>If you received this, your SMTP settings are working correctly.</p>",
  });

  if (!ok) {
    return NextResponse.json({ error: "Email failed to send. Check SMTP settings." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
