// AC-1 (issue #17): logo upload endpoint.
// Accepts multipart/form-data with a single `file` field, validates type +
// size, resizes via sharp, stores to data/uploads/, returns the public URL.

import { NextRequest, NextResponse } from "next/server";
import { saveUpload, UploadValidationError } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No file uploaded (expected a 'file' field)." },
      { status: 400 },
    );
  }

  try {
    const url = await saveUpload(file);
    return NextResponse.json({ url }, { status: 200 });
  } catch (e) {
    if (e instanceof UploadValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[uploads/logo] save failed:", (e as Error).message);
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 },
    );
  }
}
