// AC-8: build a .zip from pages posted by the browser and stream it back.

import { NextRequest, NextResponse } from "next/server";
import { buildZip } from "@/lib/zip";
import { GeneratedPage } from "@/lib/types";

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
    return NextResponse.json({ error: "No pages to zip." }, { status: 400 });
  }
  const buf = await buildZip(pages);
  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="generated-site.zip"',
    },
  });
}
