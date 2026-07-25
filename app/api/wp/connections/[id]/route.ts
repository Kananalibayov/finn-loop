// AC-4 (issue #32): delete a WP connection by ID.

import { NextRequest, NextResponse } from "next/server";
import { deleteWpConnection } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const removed = deleteWpConnection(num);
  if (!removed) {
    return NextResponse.json({ error: "Connection not found." }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
