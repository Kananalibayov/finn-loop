// AC-4 (issue #44): link/unlink a project to a wp_connections row.
// PATCH /api/projects/[id]/connection { connectionId: number | null }.
// Operator-only (behind middleware). Validates the connection exists when
// non-null; calls updateProjectConnectionId.

import { NextRequest, NextResponse } from "next/server";
import { getProject, getWpConnection, updateProjectConnectionId } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) {
    return NextResponse.json({ error: "Invalid project id." }, { status: 400 });
  }

  // Project must exist.
  const project = getProject(num);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  // Parse + validate body.
  let body: { connectionId?: number | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { connectionId } = body ?? {};

  // null (or missing) unlinks the project.
  if (connectionId === null || connectionId === undefined) {
    updateProjectConnectionId(num, null);
    return NextResponse.json({ ok: true, connectionId: null });
  }

  // Non-null must be a positive integer that resolves to an existing row.
  if (!Number.isInteger(connectionId) || connectionId <= 0) {
    return NextResponse.json(
      { error: "connectionId must be a positive integer or null." },
      { status: 400 },
    );
  }

  const conn = getWpConnection(connectionId);
  if (!conn) {
    return NextResponse.json(
      { error: `Connection ${connectionId} does not exist.` },
      { status: 404 },
    );
  }

  updateProjectConnectionId(num, connectionId);
  return NextResponse.json({ ok: true, connectionId });
}
