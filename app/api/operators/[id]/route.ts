// AC-7 (issue #74): delete an operator. Admin-only. Can't delete self or last admin.
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionRole } from "@/lib/auth";
import { deleteOperator, countAdmins } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = await verifySessionRole(token);
  if (session?.role !== "admin" && session?.operatorRole !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { id } = await params;
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  // Can't delete yourself.
  if (session.operatorId === num) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }

  // Can't delete the last admin.
  const targetIsAdmin = await (async () => {
    const { getOperatorById } = await import("@/lib/db");
    const op = getOperatorById(num);
    return op?.role === "admin";
  })();
  if (targetIsAdmin && countAdmins() <= 1) {
    return NextResponse.json({ error: "Cannot delete the last admin operator." }, { status: 400 });
  }

  const removed = deleteOperator(num);
  if (!removed) {
    return NextResponse.json({ error: "Operator not found." }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
