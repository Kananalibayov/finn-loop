// AC-4 (issue #74): current operator profile. Operator-auth.
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionRole } from "@/lib/auth";
import { getOperatorById } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = await verifySessionRole(token);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Legacy admin session → return a virtual profile.
  if (session.role === "admin") {
    return NextResponse.json({
      id: 0,
      name: "Admin",
      email: "(legacy)",
      role: "admin",
    });
  }

  // Operator session → look up the real profile.
  if (session.role === "operator" && session.operatorId) {
    const op = getOperatorById(session.operatorId);
    if (!op) {
      return NextResponse.json({ error: "Operator not found." }, { status: 404 });
    }
    const { password_hash: _ph, ...safe } = op;
    return NextResponse.json(safe);
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
