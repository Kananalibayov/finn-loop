// AC-2 (issue #18): static-host-ready ZIP export.
// Accepts GeneratedPage[], returns a ZIP with index.html + <page>.html files
// at the root, each with an injected relative nav so the folder can be dropped
// onto Netlify/Vercel/GitHub Pages and navigation works.

import { NextRequest, NextResponse } from "next/server";
import { GeneratedPage } from "@/lib/types";
import { buildStaticZip } from "@/lib/export";

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

  const buf = await buildStaticZip(pages);
  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="static-site.zip"',
    },
  });
}
