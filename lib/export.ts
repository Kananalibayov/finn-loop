// AC-1, AC-2 (issue #18): export helpers for alternative download formats.
// - buildSingleHtml(): one self-contained .html doc with all pages stacked,
//   each in an <iframe srcdoc> so their <style> blocks don't collide.
// - buildStaticZip(): a ZIP structured for static hosting — index.html +
//   <page>.html files at the root, with a relative nav (./services.html)
//   injected into each page so navigation works when served as a folder.

import JSZip from "jszip";
import { GeneratedPage, PageKey } from "./types";

/** Map page key → static-host filename (home is index.html). */
const STATIC_FILE: Record<PageKey, string> = {
  home: "index.html",
  services: "services.html",
  gallery: "gallery.html",
  contact: "contact.html",
  about: "about.html",
};

/** Map page key → display label for the nav. */
const PAGE_LABEL: Record<PageKey, string> = {
  home: "Home",
  services: "Services",
  gallery: "Gallery",
  contact: "Contact",
  about: "About",
};

/** Escape arbitrary HTML for safe embedding inside an attribute value. */
function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * AC-1: build a single self-contained HTML document containing every page,
 * each isolated inside its own <iframe srcdoc="..."> so that each page's
 * <style> rules don't bleed into the others. The result opens by
 * double-clicking — no server required.
 */
export function buildSingleHtml(pages: GeneratedPage[]): string {
  const sections = pages
    .map(
      (p) =>
        `    <section class="page" data-page="${p.key}">\n` +
        `      <h2 class="page-title">${escapeAttr(PAGE_LABEL[p.key])}</h2>\n` +
        `      <iframe class="page-frame" srcdoc="${escapeAttr(p.html)}" title="${escapeAttr(
          PAGE_LABEL[p.key],
        )}"></iframe>\n` +
        `    </section>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Generated site — all pages</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: #f4f6fb; color: #0f172a; }
    .header { padding: 20px; background: #fff; border-bottom: 1px solid #e2e8f0; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; }
    .page { max-width: 1100px; margin: 24px auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .page-title { margin: 0; padding: 10px 16px; font-size: 14px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; }
    .page-frame { width: 100%; height: 600px; border: 0; display: block; background: #fff; }
  </style>
</head>
<body>
  <div class="header"><h1>Generated website — ${pages.length} pages</h1></div>
${sections}
</body>
</html>`;
}

/**
 * AC-2: build a ZIP structured for static hosting.
 * - index.html = the home page
 * - <page-key>.html for each other page, at the root (no subfolder)
 * - Each page gets a <nav> injected with relative links (./services.html)
 *   so navigation works when served from any folder.
 *
 * The nav is injected right after <body> (or at the top of the doc if no
 * <body> tag is present). We do not rewrite absolute URLs — the generator
 * already produces self-contained HTML, so this is additive only.
 */
export async function buildStaticZip(pages: GeneratedPage[]): Promise<Buffer> {
  const zip = new JSZip();

  // Build the nav HTML once — same on every page, relative links.
  const navLinks = pages
    .map(
      (p) =>
        `<a href="./${STATIC_FILE[p.key]}"${p.key === "home" ? ' class="active"' : ""}>${escapeAttr(
          PAGE_LABEL[p.key],
        )}</a>`,
    )
    .join("\n      ");
  const navHtml = `    <nav class="static-export-nav" style="display:flex;gap:12px;padding:10px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-family:system-ui,sans-serif;font-size:14px;">
      ${navLinks}
    </nav>`;

  for (const p of pages) {
    const filename = STATIC_FILE[p.key];
    const injected = injectNav(p.html, navHtml);
    zip.file(filename, injected);
  }

  const out = await zip.generateAsync({ type: "nodebuffer" });
  return out as Buffer;
}

/**
 * Inject the nav HTML right after the opening <body> tag. If there's no
 * <body> tag (defensive — the generator always emits one), prepend it.
 * Idempotent: if a `static-export-nav` is already present, do nothing.
 */
function injectNav(html: string, navHtml: string): string {
  if (html.includes('class="static-export-nav"')) return html; // already injected
  const bodyMatch = html.match(/<body(\s[^>]*)?>/i);
  if (bodyMatch && bodyMatch.index !== undefined) {
    const insertAt = bodyMatch.index + bodyMatch[0].length;
    return html.slice(0, insertAt) + "\n" + navHtml + "\n" + html.slice(insertAt);
  }
  // No <body> — prepend nav + wrap.
  return navHtml + "\n" + html;
}
