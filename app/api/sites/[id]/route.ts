// AC-5, AC-6 (issue #4): get one saved site (full) and delete by id.

import { NextRequest, NextResponse } from "next/server";
import { deleteSite, getSite } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** AC-5: full site (input + pages) for re-rendering. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  const row = getSite(num);
  if (!row) {
    return NextResponse.json({ error: "Site not found." }, { status: 404 });
  }
  return NextResponse.json(row);
}

/** AC-6: delete a saved site. 204 on success, 404 if it never existed. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  const removed = deleteSite(num);
  if (!removed) {
    return NextResponse.json({ error: "Site not found." }, { status: 404 });
  }
  // 204 No Content — matches the issue's verification step 4.
  return new NextResponse(null, { status: 204 });
}
