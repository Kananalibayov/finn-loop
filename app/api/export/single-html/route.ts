// AC-1 (issue #18): single self-contained HTML export.
// Accepts GeneratedPage[] (same shape as /api/zip), returns one HTML document
// with all pages stacked in iframes (style isolation).

import { NextRequest, NextResponse } from "next/server";
import { GeneratedPage } from "@/lib/types";
import { buildSingleHtml } from "@/lib/export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let pages: GeneratedPage[];
  try {
    pages = (await req.json()) as GeneratedPage[];
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  if (!Array.isArray(pages) || pages.length === 0) {
    return NextResponse.json({ error: "No pages to export." }, { status: 400 });
  }

  const html = buildSingleHtml(pages);
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": 'attachment; filename="site.html"',
    },
  });
}
