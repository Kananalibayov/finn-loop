// AC-4, AC-5 (issue #68): client CRUD — list + create.
// Operator-only (behind middleware).

import { NextRequest, NextResponse } from "next/server";
import { listClients, createClient } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(listClients());
}

export async function POST(req: NextRequest) {
  let body: { name?: string; email?: string; password?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { name, email, password } = body ?? {};
  if (!name?.trim() || !email?.trim() || !password) {
    return NextResponse.json(
      { error: "name, email, and password are all required." },
      { status: 400 },
    );
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  try {
    const row = createClient({
      name: name.trim(),
      email: email.trim(),
      passwordHash: hashPassword(password),
    });
    // Safe projection — never return password_hash.
    const { password_hash: _ph, ...safe } = row;
    return NextResponse.json(safe, { status: 201 });
  } catch (e) {
    if (String((e as Error).message).includes("UNIQUE")) {
      return NextResponse.json({ error: "A client with this email already exists." }, { status: 409 });
    }
    throw e;
  }
}
