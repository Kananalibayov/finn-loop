// AC-5 (issue #16): shared page-generation core.
// Extracted from app/api/generate/route.ts so that both the fresh-generation
// endpoint (/api/generate) and the regenerate endpoint
// (/api/sites/[id]/regenerate) use the same OpenAI flow without duplication.
//
// Sequential generation (not parallel) to keep token usage predictable; the
// pages are small. Throws on any failure — callers wrap in try/catch.

import { getOpenAI, GENERATION_MODEL } from "@/lib/openai";
import { buildPrompt, cleanHtml } from "@/lib/prompts";
import { getTheme } from "@/lib/themes";
import { ALL_PAGES, BusinessInput, GeneratedPage, Mode, PageKey } from "@/lib/types";

const PAGE_TITLES: Record<PageKey, string> = {
  home: "Home",
  services: "Services",
  gallery: "Gallery",
  contact: "Contact",
  about: "About",
};

export interface GenerateOptions {
  input: BusinessInput;
  mode: Mode;
  themeId: import("@/lib/themes").ThemeId;
}

/** Generate all pages for the given input. Returns the pages + theme used. */
export async function generatePages(
  opts: GenerateOptions,
): Promise<{ pages: GeneratedPage[]; themeId: import("@/lib/themes").ThemeId }> {
  const { input, mode, themeId } = opts;
  const client = getOpenAI(); // throws clearly if OPENAI_API_KEY is missing
  const theme = getTheme(themeId);
  const pages: PageKey[] = mode === "home" ? ["home"] : ALL_PAGES;

  const out: GeneratedPage[] = [];
  for (const page of pages) {
    const { system, user } = buildPrompt(page, input, theme);
    const res = await client.chat.completions.create({
      model: GENERATION_MODEL,
      temperature: 0.7,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const raw = res.choices[0]?.message?.content ?? "";
    out.push({ key: page, title: PAGE_TITLES[page], html: cleanHtml(raw) });
  }
  return { pages: out, themeId: theme.id };
}
