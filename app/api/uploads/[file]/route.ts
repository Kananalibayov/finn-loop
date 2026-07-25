// AC-4 (issue #17): serve a stored upload with correct Content-Type +
// long-lived Cache-Control. The data/ dir is not statically servable, so
// images go through this route.

import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { getUploadPath, mimeFor } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  const path = getUploadPath(file);

  if (!existsSync(path)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { readFile } = await import("node:fs/promises");
  const buf = await readFile(path);
  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": mimeFor(file),
      // Logos rarely change — let the browser cache aggressively.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
