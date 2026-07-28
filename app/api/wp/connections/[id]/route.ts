// AC-4 (issue #32): delete a WP connection by ID.
// Issue #100 (GAP-LEDGER §8.1): admin-only — destroys a client's stored credentials.
import { NextRequest, NextResponse } from "next/server";
import { deleteWpConnection } from "@/lib/db";
import { COOKIE_NAME, requireRole } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(req.cookies.get(COOKIE_NAME)?.value, "admin");
  if (!session) { return NextResponse.json({ error: "Admin access required." }, { status: 403 }); }
  const { id } = await params;
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) { return NextResponse.json({ error: "Invalid id." }, { status: 400 }); }
  const removed = deleteWpConnection(num);
  if (!removed) { return NextResponse.json({ error: "Connection not found." }, { status: 404 }); }
  return new NextResponse(null, { status: 204 });
}
