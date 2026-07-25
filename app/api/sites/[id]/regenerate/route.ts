// AC-5 (issue #16): regenerate a saved site with edited input.
// Reads the original site (for its site_group_id + theme/mode), runs the
// shared generation pipeline with the edited input, inserts a new row in the
// same group via regenerateSite(), and returns the new site's id.

import { NextRequest, NextResponse } from "next/server";
import { getSite, regenerateSite } from "@/lib/db";
import { generatePages } from "@/lib/generate";
import type { BusinessInput, Mode } from "@/lib/types";
import type { ThemeId } from "@/lib/themes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  // Load the original site — it carries site_group_id, mode, themeId.
  const original = getSite(num);
  if (!original) {
    return NextResponse.json({ error: "Site not found." }, { status: 404 });
  }

  // Parse the edited input from the request body.
  let body: { input?: BusinessInput };
  try {
    body = (await req.json()) as { input?: BusinessInput };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const input = body?.input;
  if (!input?.businessName?.trim()) {
    return NextResponse.json(
      { error: "Business name is required." },
      { status: 400 },
    );
  }

  // Reuse the original's mode + theme (NG-4: no UI to change these in the
  // edit form; editing is input-only). Cast is safe — mode/theme were
  // validated when the original was generated.
  const mode = original.mode as Mode;
  const themeId = original.theme_id as ThemeId;

  try {
    const { pages } = await generatePages({ input, mode, themeId });

    // Insert the new version in the original's group (original row preserved).
    const newId = regenerateSite(original.site_group_id, {
      businessName: input.businessName,
      tagline: input.tagline,
      themeId,
      mode,
      inputJson: JSON.stringify(input),
      pagesJson: JSON.stringify(pages),
    });

    return NextResponse.json({ id: newId }, { status: 200 });
  } catch (e) {
    const msg = (e as Error).message || "Regeneration failed.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
