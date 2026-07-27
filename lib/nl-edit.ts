// NL editing: apply a plain-English instruction to an HTML page via LLM.
// Sends the current page HTML + the instruction to the configured model,
// which returns the full modified HTML. Tight prompt: change ONLY what's asked.

import { getOpenAI } from "@/lib/openai";
import { getEffectiveGenerationModel } from "@/lib/db";
import { cleanHtml } from "@/lib/prompts";

const SYSTEM_PROMPT = `You are editing an existing standalone HTML page. You will be given the current HTML and a change instruction in plain English.

Rules:
- Make ONLY the requested change. Do not rewrite, restructure, or restyle anything else.
- Return the COMPLETE modified HTML document (<!doctype html>...</html>). Not a diff, not a fragment.
- Preserve all existing content, styles, scripts, and structure except where the instruction applies.
- If the instruction is ambiguous, make the most reasonable interpretation.
- Output ONLY the HTML. No prose, no markdown fences, no commentary.`;

/**
 * Apply a natural-language instruction to an HTML page.
 * Returns the full modified HTML document.
 */
export async function applyEdit(
  pageHtml: string,
  instruction: string,
): Promise<string> {
  const client = getOpenAI();
  const model = getEffectiveGenerationModel();

  const res = await client.chat.completions.create({
    model,
    temperature: 0.3, // low temp — precise edits, not creative rewrites
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `CURRENT HTML:\n\n${pageHtml}\n\nCHANGE TO MAKE:\n${instruction}`,
      },
    ],
  });

  const raw = res.choices[0]?.message?.content ?? "";
  return cleanHtml(raw);
}
