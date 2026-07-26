// AC-3 (issue #52): screenshot → template intake endpoint.
// Accepts multipart/form-data (file + optional name/description/category),
// saves the image via saveUpload, runs the vision model, inserts a template.

import { NextRequest, NextResponse } from "next/server";
import { saveUpload, getUploadPath, UploadValidationError } from "@/lib/uploads";
import { generateTemplateFromImage } from "@/lib/template-from-image";
import { insertTemplate } from "@/lib/db";

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

  // Optional metadata fields.
  const name = (form.get("name") as string | null)?.trim() || `From screenshot ${new Date().toLocaleDateString()}`;
  const description = (form.get("description") as string | null)?.trim() || "Generated from an uploaded screenshot.";
  const category = (form.get("category") as string | null)?.trim() || "scanned";

  // AC-3a: save + resize the file (reuses the logo-upload pipeline).
  let publicUrl: string;
  try {
    publicUrl = await saveUpload(file);
  } catch (e) {
    if (e instanceof UploadValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[from-screenshot] save failed:", (e as Error).message);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }

  // AC-3b: resolve the on-disk path (publicUrl is "/api/uploads/<uuid>.<ext>").
  const filename = publicUrl.split("/").pop()!;
  const diskPath = getUploadPath(filename);

  // AC-3c: run the vision model + parse.
  let generated: Awaited<ReturnType<typeof generateTemplateFromImage>>;
  try {
    generated = await generateTemplateFromImage(diskPath);
  } catch (e) {
    const msg = (e as Error).message || "Vision generation failed.";
    console.error("[from-screenshot] vision failed:", msg);
    // Upstream / parse errors → 502. The image was already saved; that's fine
    // (it's just an unused asset, no template row was created).
    return NextResponse.json(
      { error: /OPENAI|API|network|timeout|model/i.test(msg) ? `Generation failed: ${msg}` : msg },
      { status: 502 },
    );
  }

  // AC-3d: insert the template.
  const row = insertTemplate({
    name,
    description,
    category,
    specJson: JSON.stringify(generated.spec),
    pagesJson: JSON.stringify(generated.pages),
    source: "screenshot",
  });
  return NextResponse.json(row, { status: 201 });
}
