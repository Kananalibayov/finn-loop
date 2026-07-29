// AC-5, AC-6 (issue #74): operator list + create. Admin-only.
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionRole } from "@/lib/auth";
import { listOperators, createOperator } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = await verifySessionRole(token);
  // Legacy admin (role: "admin") + new operators with role "admin" are both allowed.
  return session?.role === "admin" || session?.operatorRole === "admin";
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  return NextResponse.json(listOperators());
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  let body: { name?: string; email?: string; password?: string; role?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { name, email, password, role } = body ?? {};
  if (!name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: "name, email, and password are required." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }
  const validRole = role === "admin" || role === "editor" || role === "viewer" ? role : "editor";

  try {
    const row = createOperator({
      name: name.trim(),
      email: email.trim(),
      passwordHash: hashPassword(password),
      role: validRole,
    });
    const { password_hash: _ph, ...safe } = row;
    return NextResponse.json(safe, { status: 201 });
  } catch (e) {
    if (String((e as Error).message).includes("UNIQUE")) {
      return NextResponse.json({ error: "An operator with this email already exists." }, { status: 409 });
    }
    throw e;
  }
}
