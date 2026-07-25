// AC-4, AC-5, AC-6, AC-9: generate endpoint.
// Calls OpenAI once per requested page, returns the generated HTML.
// On any failure, returns a structured error so the UI can show + retry.
//
// AC-5 (issue #16): the page-generation core now lives in lib/generate.ts so
// both this endpoint and /api/sites/[id]/regenerate share one implementation.

import { NextRequest, NextResponse } from "next/server";
import { getTheme } from "@/lib/themes";
import { GenerateRequest, GenerateResponse } from "@/lib/types";
import { insertSite } from "@/lib/db";
import { generatePages } from "@/lib/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: GenerateRequest;
  try {
    body = (await req.json()) as GenerateRequest;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  // Basic validation — missing critical fields surface as a 400.
  const { input, mode, themeId } = body ?? {};
  if (!input?.businessName?.trim()) {
    return NextResponse.json(
      { error: "Business name is required." },
      { status: 400 },
    );
  }
  if (mode !== "full" && mode !== "home") {
    return NextResponse.json({ error: "Invalid mode." }, { status: 400 });
  }

  try {
    const { pages, themeId: resolvedThemeId } = await generatePages({
      input,
      mode,
      themeId,
    });

    const theme = getTheme(themeId);
    const response: GenerateResponse = {
      pages,
      themeId: resolvedThemeId,
      defaultsApplied: {
        // AC-9: report whether defaults were used so the UI can show it.
        logo: !input.logoUrl,
        colors: !input.brandColors,
      },
    };

    // AC-3 (issue #4): persist the generated site after a successful build.
    // Best-effort — a persistence failure must not fail an otherwise-successful
    // generation. The presence of `id` in the response is the save signal.
    try {
      response.id = insertSite({
        businessName: input.businessName,
        tagline: input.tagline,
        themeId: theme.id,
        mode,
        inputJson: JSON.stringify(input),
        pagesJson: JSON.stringify(pages),
      });
    } catch (persistErr) {
      console.error("[generate] DB save failed:", (persistErr as Error).message);
    }

    return NextResponse.json(response);
  } catch (e) {
    // Includes the OPENAI_API_KEY-missing case from getOpenAI().
    const msg = (e as Error).message || "Generation failed.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
