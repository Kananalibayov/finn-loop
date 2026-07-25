// AC-4, AC-5, AC-6, AC-9: generate endpoint.
// Calls OpenAI once per requested page, returns the generated HTML.
// On any failure, returns a structured error so the UI can show + retry.

import { NextRequest, NextResponse } from "next/server";
import { getOpenAI, GENERATION_MODEL } from "@/lib/openai";
import { buildPrompt, cleanHtml } from "@/lib/prompts";
import { getTheme } from "@/lib/themes";
import { ALL_PAGES, GenerateRequest, GenerateResponse, GeneratedPage, PageKey } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_TITLES: Record<PageKey, string> = {
  home: "Home",
  services: "Services",
  gallery: "Gallery",
  contact: "Contact",
  about: "About",
};

async function generatePage(
  client: ReturnType<typeof getOpenAI>,
  page: PageKey,
  body: GenerateRequest,
): Promise<GeneratedPage> {
  const theme = getTheme(body.themeId);
  const { system, user } = buildPrompt(page, body.input, theme);
  const res = await client.chat.completions.create({
    model: GENERATION_MODEL,
    temperature: 0.7,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const raw = res.choices[0]?.message?.content ?? "";
  return { key: page, title: PAGE_TITLES[page], html: cleanHtml(raw) };
}

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

  let client;
  try {
    client = getOpenAI();
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }

  const pages = mode === "home" ? (["home"] as PageKey[]) : ALL_PAGES;

  try {
    // Sequential to keep token usage predictable; pages are small.
    const out: GeneratedPage[] = [];
    for (const p of pages) {
      out.push(await generatePage(client, p, body));
    }

    const theme = getTheme(themeId);
    const response: GenerateResponse = {
      pages: out,
      themeId: theme.id,
      defaultsApplied: {
        // AC-9: report whether defaults were used so the UI can show it.
        logo: !input.logoUrl,
        colors: !input.brandColors,
      },
    };
    return NextResponse.json(response);
  } catch (e) {
    const msg = (e as Error).message || "Generation failed.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
