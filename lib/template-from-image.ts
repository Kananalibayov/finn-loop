// AC-1, AC-2 (issue #52): convert a design screenshot into a reusable template.
// Uses gpt-4o vision to extract a spec (palette/fonts/voice) and author frozen
// HTML for all 5 pages, written to match the screenshot's aesthetic and using
// the same {{placeholders}} + CSS-variable conventions as the built-in
// templates — so the result is immediately deliverable via #54's frozen path.

import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { getOpenAI } from "@/lib/openai";

/** AC-1: vision MUST use gpt-4o (the configured generation model may be
 *  gpt-4o-mini, which doesn't handle vision well for this complex task). */
const VISION_MODEL = "gpt-4o";

/** AC-2: the system prompt establishing the model's role + output contract. */
export const VISION_SYSTEM_PROMPT = `You are a senior web designer analyzing a screenshot of a website or design mockup and reproducing it as a reusable 5-page website template.

Your output MUST be a single JSON object — no prose, no markdown fences — with this exact shape:
{
  "spec": {
    "vars": {
      "--color-bg": "#...",
      "--color-text": "#...",
      "--color-primary": "#...",
      "--color-muted": "#...",
      "--color-surface": "#...",
      "--font-sans": "...",
      "--radius": "..."
    },
    "voice": "one phrase describing the tone/voice to match when generating copy"
  },
  "pages": {
    "home": "<full html string>",
    "services": "<full html string>",
    "gallery": "<full html string>",
    "contact": "<full html string>",
    "about": "<full html string>"
  }
}

Rules for the pages:
- Each value is a COMPLETE standalone HTML document (<!doctype html>...</html>).
- Inline a <style> block in :root defining the extracted CSS variables.
- Use semantic HTML5, a header with nav linking the 5 pages (home.html, services.html, gallery.html, contact.html, about.html), and a footer.
- Where business info would appear, use these exact placeholders: {{businessName}}, {{tagline}}, {{phone}}, {{email}}, {{address}}, {{services}}. ({{services}} will be replaced with a <ul>.)
- Match the screenshot's aesthetic as closely as possible: palette, typography style, layout density, spacing, sectioning.
- No external CSS/JS/CDNs. Use https://picsum.photos placeholders for images in the gallery.
- Output ONLY the JSON object.`;

/** AC-2: the user prompt accompanying the image. Kept short — the system
 *  prompt carries the contract; this just points at the image. */
export const VISION_USER_PROMPT = "Analyze this screenshot and produce the template JSON per the system instructions.";

/** AC-1: the result shape — spec + pages, ready to feed to insertTemplate. */
export interface GeneratedTemplateContent {
  spec: { vars: Record<string, string>; voice?: string };
  pages: Record<string, string>;
}

/** The 5 page keys the model must produce. Used for validation. */
const REQUIRED_PAGES = ["home", "services", "gallery", "contact", "about"];

/** AC-1: read the image, call gpt-4o vision, parse the JSON template. */
export async function generateTemplateFromImage(
  imagePath: string,
): Promise<GeneratedTemplateContent> {
  const dataUrl = imageToDataUrl(imagePath);

  const client = getOpenAI();
  const res = await client.chat.completions.create({
    model: VISION_MODEL,
    temperature: 0.4, // lower temp — we want faithful reproduction, not creativity
    messages: [
      { role: "system", content: VISION_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: VISION_USER_PROMPT },
          { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
        ],
      },
    ],
  });

  const raw = res.choices[0]?.message?.content ?? "";
  return parseTemplateJson(raw);
}

/** Read the image file from disk + encode as a base64 data URL the vision API
 *  accepts. Derives MIME from the extension (the file was validated/normalized
 *  by saveUpload, so .png/.jpg/.webp are the only possibilities). */
function imageToDataUrl(imagePath: string): string {
  const buf = readFileSync(imagePath);
  const mime = mimeForExt(extname(imagePath));
  const b64 = buf.toString("base64");
  return `data:${mime};base64,${b64}`;
}

function mimeForExt(ext: string): string {
  const e = ext.toLowerCase();
  if (e === ".png") return "image/png";
  if (e === ".jpg" || e === ".jpeg") return "image/jpeg";
  if (e === ".webp") return "image/webp";
  return "application/octet-stream";
}

/** AC-1: parse + validate the model's JSON output. Strips markdown fences if
 *  the model added them despite instructions. Throws clearly on malformed
 *  output so the caller can surface a 502. */
export function parseTemplateJson(raw: string): GeneratedTemplateContent {
  let s = raw.trim();
  // Strip ```json ... ``` or ``` ... ``` fences if present.
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  // Some models wrap JSON in <json>...</json>; strip if so.
  s = s.replace(/^<json>\s*/i, "").replace(/<\/json>\s*$/i, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(s);
  } catch {
    throw new Error("The model did not return valid JSON. Try a clearer screenshot or retry.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("The model returned non-object JSON.");
  }
  const obj = parsed as Record<string, unknown>;
  const spec = obj.spec;
  const pages = obj.pages;
  if (typeof spec !== "object" || spec === null || typeof pages !== "object" || pages === null) {
    throw new Error("The model output is missing the 'spec' or 'pages' object.");
  }
  const specObj = spec as Record<string, unknown>;
  if (typeof specObj.vars !== "object" || specObj.vars === null) {
    throw new Error("The model output's spec is missing the 'vars' object.");
  }
  // Validate all 5 pages are present + strings.
  const pagesObj = pages as Record<string, unknown>;
  for (const key of REQUIRED_PAGES) {
    if (typeof pagesObj[key] !== "string" || pagesObj[key].length === 0) {
      throw new Error(`The model output is missing the "${key}" page HTML.`);
    }
  }
  return {
    spec: specObj as unknown as GeneratedTemplateContent["spec"],
    pages: pagesObj as unknown as GeneratedTemplateContent["pages"],
  };
}
