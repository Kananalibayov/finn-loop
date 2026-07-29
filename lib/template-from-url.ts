// AC-1, AC-2 (issue #53): live-site URL → template.
// Fetches the site's HTML server-side, strips heavy content (scripts/styles),
// sends the structural excerpt to gpt-4o (text-in → template-JSON-out, same
// JSON contract as #52), and reuses parseTemplateJson for validation.

import type { GeneratedTemplateContent } from "./template-from-image.ts";
import { assertPublicHttpTarget } from "./net.ts";

// Re-export so callers can import everything from one place.
export type { GeneratedTemplateContent };

/** AC-1: analysis uses gpt-4o for quality (same rationale as #52). */
const ANALYSIS_MODEL = "gpt-4o";

/** AC-1: fetch constraints. */
const FETCH_TIMEOUT_MS = 15_000;
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB response cap
const MAX_REDIRECTS = 3;
const USER_AGENT = "FinnLoopTemplateScanner/1.0 (agency template intake; operator-directed)";

/** AC-2: the system prompt — same JSON output contract as #52's vision prompt,
 *  but framed for HTML-text analysis. */
export const URL_SYSTEM_PROMPT = `You are a senior web designer analyzing the HTML source of a live website and reproducing its design as a reusable 5-page website template.

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
- Match the source site's aesthetic as closely as possible: palette, typography, layout density, spacing, sectioning.
- The HTML you're given may be incomplete (many sites render content with JavaScript, which we can't execute). Do your best with what's present — infer sensible defaults for anything missing. Use meta tags, inline styles, class names, and <link> hrefs as clues.
- No external CSS/JS/CDNs in the output. Use https://picsum.photos placeholders for images in the gallery.
- Output ONLY the JSON object.`;

/** AC-2: the user prompt — short; the HTML goes in here. */
export const URL_USER_PROMPT = (url: string, html: string) =>
  `Here is the HTML source of ${url} (scripts and styles stripped for focus; class names and link hrefs preserved):\n\n${html}\n\nProduce the template JSON per the system instructions.`;

/** AC-1: fetch the URL's HTML with constraints. Throws clearly on any failure. */
export async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res: Response;
  let redirectCount = 0;
  let currentUrl = url;

  try {
    // Manual redirect loop to enforce MAX_REDIRECTS (fetch's `redirect: "follow"`
    // has no built-in cap and some sites redirect-loop).
    while (true) {
      await assertPublicHttpTarget(currentUrl);
      res = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
        },
      });

      // 3xx → follow manually (with a cap).
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) throw new Error("Server returned a redirect with no Location header.");
        if (++redirectCount > MAX_REDIRECTS) {
          throw new Error(`Site redirected more than ${MAX_REDIRECTS} times (possible redirect loop).`);
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      if (!res.ok) {
        throw new Error(`Site returned HTTP ${res.status} ${res.statusText}.`);
      }
      break;
    }

    // Read with a size cap (avoid pulling a 50 MB page into memory).
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      throw new Error(`URL did not return HTML (content-type: ${contentType || "unknown"}).`);
    }

    // Stream-read up to MAX_BYTES+1 to detect overflow.
    const reader = res.body?.getReader();
    if (!reader) {
      // Fallback: arrayBuffer (small responses).
      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_BYTES) {
        throw new Error(`Response is too large (${(buf.byteLength / 1024 / 1024).toFixed(1)} MB; limit is 2 MB).`);
      }
      return new TextDecoder().decode(buf);
    }

    let received = 0;
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        received += value.length;
        if (received > MAX_BYTES) {
          throw new Error(`Response exceeded the 2 MB size cap.`);
        }
        chunks.push(value);
      }
    }
    const merged = new Uint8Array(received);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    return new TextDecoder().decode(merged);
  } finally {
    clearTimeout(timeout);
  }
}

/** Strip <script> and <style> contents to reduce tokens + focus the model on
 *  structure, meta, class names, and inline styles. Keeps <link rel="stylesheet">
 *  hrefs (font/framework clues). */
function stripHeavyContent(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
}

/** AC-1: fetch + analyze a URL into a template. Reuses parseTemplateJson. */
export async function generateTemplateFromUrl(url: string): Promise<GeneratedTemplateContent> {
  const parsedUrl = await assertPublicHttpTarget(url);

  const rawHtml = await fetchHtml(parsedUrl.toString());
  const stripped = stripHeavyContent(rawHtml);

  if (stripped.trim().length < 50) {
    throw new Error(
      "The page returned almost no HTML. It may be JavaScript-rendered; we can't execute JS, so there's nothing to analyze.",
    );
  }

  const [{ getOpenAI }, { parseTemplateJson }] = await Promise.all([
    import("./openai.ts"),
    import("./template-from-image.ts"),
  ]);
  const client = getOpenAI();
  const res = await client.chat.completions.create({
    model: ANALYSIS_MODEL,
    temperature: 0.4,
    messages: [
      { role: "system", content: URL_SYSTEM_PROMPT },
      { role: "user", content: URL_USER_PROMPT(parsedUrl.toString(), stripped) },
    ],
  });

  const content = res.choices[0]?.message?.content ?? "";
  return parseTemplateJson(content);
}
