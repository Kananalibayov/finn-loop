// Phase 0.9 (standing mandate, wire-as-you-go): version history for a project.
// Metadata only — full models load through getSiteModelVersion on demand.

import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, requireRole } from "@/lib/auth";
import { getProject, listSiteModelVersions } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Newest-first version metadata plus the project's head pointer.
 *  A project with no versions returns an empty list and head_version_id
 *  null — the honest legacy state, not an error. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Operator-only. Middleware already gates non-public paths, but the in-handler
  // check is the enforced one (lib/route-auth.test.mts ratchets on it).
  const session = await requireRole(req.cookies.get(COOKIE_NAME)?.value, "editor");
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 403 });
  }
  const { id } = await params;
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  const row = getProject(num);
  if (!row) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  return NextResponse.json({
    head_version_id: row.head_version_id,
    versions: listSiteModelVersions(num),
  });
}
