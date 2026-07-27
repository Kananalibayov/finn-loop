// AC-7 (issue #68): client login. PUBLIC (not behind middleware).
import { NextRequest, NextResponse } from "next/server";
import { getClientByEmail, logActivity } from "@/lib/db";
import { verifyPasswordAgainstHash, createClientSessionCookie } from "@/lib/auth";

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
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const client = getClientByEmail(email);
  if (!client) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  if (!verifyPasswordAgainstHash(password, [client.password_hash])) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const cookie = await createClientSessionCookie(client.id);
  logActivity({
    eventType: "client_login",
    description: `Client "${client.name}" logged in to the portal`,
    clientId: client.id,
  });
  return NextResponse.json({ redirect: "/portal" }, { status: 200, headers: { "Set-Cookie": cookie } });
}
