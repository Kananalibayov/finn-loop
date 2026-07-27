// AC-9 (issue #68): client profile. Requires a client session (role: "client").

import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionRole } from "@/lib/auth";
import { getClientById } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = await verifySessionRole(token);
  if (!session || session.role !== "client" || !session.clientId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = getClientById(session.clientId);
  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  const { password_hash: _ph, ...safe } = client;
  return NextResponse.json(safe);
}
