// Client-scoped project list. Returns projects assigned to the logged-in client.
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionRole } from "@/lib/auth";
import { listProjectsForClient } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = await verifySessionRole(token);
  if (!session || session.role !== "client" || !session.clientId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = listProjectsForClient(session.clientId);
  // Return the first page's HTML for preview + health fields.
  return NextResponse.json(projects.map((p) => {
    let firstPageHtml = "";
    try {
      const pages = JSON.parse(p.pages_json) as Array<{ key: string; html: string }>;
      firstPageHtml = pages.find((pg) => pg.key === "home")?.html ?? pages[0]?.html ?? "";
    } catch { /* empty */ }
    const { pages_json: _pj, ...safe } = p;
    return { ...safe, previewHtml: firstPageHtml };
  }));
}
