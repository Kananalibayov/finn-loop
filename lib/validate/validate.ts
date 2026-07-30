// Deterministic quality gates between "rendered" and "deliverable" — issue #195.
// NORTH-STAR §4: a failing gate holds the page as a draft and surfaces the reason.
// Pure string/structure checks over our own renderer's known-shape output — no
// I/O, no DOM, no HTML parser, no new dependency. Reports; never mutates (NG-5).

import type { RenderedSite } from "../render/render-html.ts";
import { sectionInstanceId } from "../sections/registry.ts";
import type { SiteModel } from "../site-model.ts";

export interface Violation { gate: string; page: string | null; message: string; }
export interface ValidationReport { ok: boolean; violations: Violation[]; }

export const GATE_H1 = "structure/h1";
export const GATE_LANDMARKS = "structure/landmarks";
export const GATE_TITLE = "structure/title";
export const GATE_LINKS = "structure/links";
export const GATE_PLACEHOLDERS = "content/placeholders";
export const GATE_ALT = "content/alt";
export const GATE_INLINE_STYLE = "tokens/no-inline-style";
export const GATE_INSTANCE_IDS = "sections/instance-ids";

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

function violation(gate: string, page: string | null, message: string): Violation {
  return { gate, page, message };
}

/** structure/h1 — every page carries exactly one <h1> heading. */
export function checkH1(rendered: RenderedSite): Violation[] {
  const violations: Violation[] = [];
  for (const { slug, html } of rendered.pages) {
    const count = occurrences(html, "<h1");
    if (count !== 1) {
      violations.push(violation(GATE_H1, slug, `page "${slug}": expected exactly one <h1>, found ${count}`));
    }
  }
  return violations;
}

/** structure/landmarks — every page has header, main and footer elements. */
export function checkLandmarks(rendered: RenderedSite): Violation[] {
  const violations: Violation[] = [];
  for (const { slug, html } of rendered.pages) {
    for (const landmark of ["<header", "<main", "<footer"]) {
      if (!html.includes(landmark)) {
        violations.push(violation(GATE_LANDMARKS, slug, `page "${slug}": expected a ${landmark}> landmark element, found none`));
      }
    }
  }
  return violations;
}

/** structure/title — non-empty <title> and meta description per page, each unique site-wide. */
export function checkTitle(rendered: RenderedSite): Violation[] {
  const violations: Violation[] = [];
  const seen = { title: new Map<string, string[]>(), description: new Map<string, string[]>() };
  for (const { slug, html } of rendered.pages) {
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? null;
    if (title === null || title.trim() === "") {
      violations.push(violation(GATE_TITLE, slug, `page "${slug}": expected a non-empty <title>, found ${title === null ? "none" : "an empty one"}`));
    } else seen.title.set(title, [...(seen.title.get(title) ?? []), slug]);
    const description = html.match(/<meta name="description" content="([^"]*)">/)?.[1] ?? null;
    if (description === null || description.trim() === "") {
      violations.push(violation(GATE_TITLE, slug, `page "${slug}": expected a <meta name="description"> with non-empty content, found ${description === null ? "none" : "an empty one"}`));
    } else seen.description.set(description, [...(seen.description.get(description) ?? []), slug]);
  }
  for (const [kind, plural] of [["title", "titles"], ["description", "descriptions"]] as const) {
    for (const [value, slugs] of seen[kind]) {
      if (slugs.length > 1) {
        violations.push(violation(GATE_TITLE, null, `site-wide: ${kind} "${value}" is shared by pages ${slugs.map((s) => `"${s}"`).join(", ")} — ${plural} must be unique across pages`));
      }
    }
  }
  return violations;
}

/**
 * structure/links — internal <a> hrefs (starting "/") must resolve to "/" or a
 * page slug. External, fragment (including safeHref's "#"), mailto: and tel: pass.
 */
export function checkLinks(rendered: RenderedSite): Violation[] {
  const allowed = ["/", ...rendered.pages.map((page) => `/${page.slug}`)];
  const violations: Violation[] = [];
  for (const { slug, html } of rendered.pages) {
    for (const match of html.matchAll(/<a\b[^>]*?href="([^"]*)"/g)) {
      const href = match[1];
      if (href.startsWith("/") && !allowed.includes(href)) {
        violations.push(violation(GATE_LINKS, slug, `page "${slug}": internal link "${href}" resolves to no page (expected one of ${allowed.map((a) => `"${a}"`).join(", ")})`));
      }
    }
  }
  return violations;
}

/** content/placeholders — no lorem ipsum and no unreplaced {{…}} tokens. */
export function checkPlaceholders(rendered: RenderedSite): Violation[] {
  const violations: Violation[] = [];
  for (const { slug, html } of rendered.pages) {
    if (/lorem ipsum/i.test(html)) {
      violations.push(violation(GATE_PLACEHOLDERS, slug, `page "${slug}": contains "lorem ipsum" placeholder text (expected real copy before publishing)`));
    }
    const token = html.match(/\{\{[^{}]*\}\}/);
    if (token) {
      violations.push(violation(GATE_PLACEHOLDERS, slug, `page "${slug}": contains unreplaced placeholder "${token[0]}" (expected every template token substituted)`));
    }
  }
  return violations;
}

/** content/alt — every <img> carries a non-empty alt attribute. */
export function checkAlt(rendered: RenderedSite): Violation[] {
  const violations: Violation[] = [];
  for (const { slug, html } of rendered.pages) {
    const images = html.match(/<img\b[^>]*>/g) ?? [];
    images.forEach((img, index) => {
      const alt = img.match(/\balt="([^"]*)"/)?.[1];
      if (alt === undefined || alt.trim() === "") {
        violations.push(violation(GATE_ALT, slug, `page "${slug}": image ${index + 1} of ${images.length} has ${alt === undefined ? "no" : "an empty"} alt attribute (expected descriptive alt text on every image)`));
      }
    });
  }
  return violations;
}

/** tokens/no-inline-style — re-verifies independently what renderHtml guarantees: no <style>, no style="…". */
export function checkNoInlineStyle(rendered: RenderedSite): Violation[] {
  const violations: Violation[] = [];
  for (const { slug, html } of rendered.pages) {
    if (html.includes("<style")) {
      violations.push(violation(GATE_INLINE_STYLE, slug, `page "${slug}": contains a <style> block (expected all styling in the shared stylesheet)`));
    }
    if (html.includes('style="')) {
      violations.push(violation(GATE_INLINE_STYLE, slug, `page "${slug}": contains an inline style="…" attribute (expected styling via tokens and classes only)`));
    }
  }
  return violations;
}

/**
 * sections/instance-ids — each model section's data-section-instance id must
 * appear in its page's HTML, and the attribute count must equal the section count.
 */
export function checkInstanceIds(model: SiteModel, rendered: RenderedSite): Violation[] {
  const violations: Violation[] = [];
  for (const page of model.pages) {
    const renderedPage = rendered.pages.find((entry) => entry.slug === page.slug);
    if (!renderedPage) {
      violations.push(violation(GATE_INSTANCE_IDS, page.slug, `page "${page.slug}": no rendered HTML for the page's ${page.sections.length} section(s) (the page was dropped from the render)`));
      continue;
    }
    const expected = page.sections.map((section, index) => sectionInstanceId(section.type, section.variant, index));
    const missing = expected.filter((id) => !renderedPage.html.includes(`data-section-instance="${id}"`));
    for (const id of missing) {
      violations.push(violation(GATE_INSTANCE_IDS, page.slug, `page "${page.slug}": expected data-section-instance="${id}" is absent (section silently dropped)`));
    }
    const found = occurrences(renderedPage.html, "data-section-instance=");
    if (missing.length === 0 && found !== expected.length) {
      violations.push(violation(GATE_INSTANCE_IDS, page.slug, `page "${page.slug}": found ${found} data-section-instance attribute(s), expected ${expected.length} (duplicated or extra section markup)`));
    }
  }
  return violations;
}

/**
 * Run every gate; return the full list — no first-failure short-circuit.
 * `ok` is derived from the violation list, never set independently
 * (GAP-LEDGER pattern 1 / Invariant 4).
 */
export function validateSite(model: SiteModel, rendered: RenderedSite): ValidationReport {
  const violations: Violation[] = [
    ...checkH1(rendered),
    ...checkLandmarks(rendered),
    ...checkTitle(rendered),
    ...checkLinks(rendered),
    ...checkPlaceholders(rendered),
    ...checkAlt(rendered),
    ...checkNoInlineStyle(rendered),
    ...checkInstanceIds(model, rendered),
  ];
  return { ok: violations.length === 0, violations };
}
