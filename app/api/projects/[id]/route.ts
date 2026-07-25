// AC-5, AC-6 (issue #4): get one saved project (full) and delete by id.

import { NextRequest, NextResponse } from "next/server";
import { deleteProject, getProject } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** AC-5: full project (input + pages) for re-rendering. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  const row = getProject(num);
  if (!row) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  return NextResponse.json(row);
}

/** AC-6: delete a saved project. 204 on success, 404 if it never existed. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  const removed = deleteProject(num);
  if (!removed) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  // 204 No Content.
  return new NextResponse(null, { status: 204 });
}
