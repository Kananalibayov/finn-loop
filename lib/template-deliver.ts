// AC-1, AC-2, AC-3 (issue #54): template → delivered site core logic.
// Implements the hybrid delivery model decided in epic #50:
//  - Frozen path: substitute {{placeholders}} in the template's pages_json.
//    Instant, no LLM call, perfectly consistent.
//  - Guided path: synthesize a Theme from the spec and call generatePages().
//    Fresh LLM HTML guided by the template's aesthetic.

import { generatePages } from "@/lib/generate";
import type { Theme } from "@/lib/themes";
import type { BusinessInput, GeneratedPage, PageKey } from "@/lib/types";
import type { TemplateRow } from "@/lib/db";

// AC-1: the placeholder list lives in a separate data-only module
// (lib/template-placeholders.ts) so client components can import it without
// pulling this server-only module (→ generate → db → better-sqlite3) into the
// browser bundle. Re-exported here for server-side convenience.
export { TEMPLATE_PLACEHOLDERS } from "@/lib/template-placeholders";

/** AC-1: replace the {{placeholders}} in frozen HTML with client info.
 *  - {{services}} is rendered as a <ul> of the services list (or "" if none).
 *  - Unknown placeholders are left untouched (no crash). */
export function substitutePlaceholders(html: string, input: BusinessInput): string {
  const servicesHtml =
    input.services.length > 0
      ? `<ul>${input.services.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>`
      : "";
  return html
    .replace(/\{\{businessName\}\}/g, escapeHtml(input.businessName))
    .replace(/\{\{tagline\}\}/g, escapeHtml(input.tagline))
    .replace(/\{\{phone\}\}/g, escapeHtml(input.phone))
    .replace(/\{\{email\}\}/g, escapeHtml(input.email))
    .replace(/\{\{address\}\}/g, escapeHtml(input.address))
    .replace(/\{\{services\}\}/g, servicesHtml);
}

/** Minimal HTML-escape for substituted text (prevents broken markup / XSS
 *  from client-provided content). */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** AC-2: build a Theme object from a template's spec, suitable for
 *  generatePages(). The vars become CSS variables; voice is folded into the
 *  description so the LLM picks up the tone. */
export function synthesizeTheme(
  spec: { vars: Record<string, string>; voice?: string },
  name: string,
  description: string,
): Theme {
  const fullDescription = spec.voice
    ? `${description}. Voice: ${spec.voice}.`
    : description;
  return {
    // generatePages only uses `id` for the return value, not for lookup, so a
    // fixed "template" string is safe here.
    id: "template",
    name,
    description: fullDescription,
    vars: spec.vars,
  };
}

export type DeliverMode = "frozen" | "guided" | "auto";

/** AC-3: deliver a site from a template using the hybrid model.
 *  - mode="frozen" OR (mode="auto" AND template has pages_json) → substitute.
 *  - mode="guided" OR (mode="auto" with no pages_json) → generatePages().
 *  Throws if frozen is requested/required but the template has no pages_json. */
export async function deliverFromTemplate(
  template: TemplateRow,
  input: BusinessInput,
  mode: DeliverMode,
): Promise<{ pages: GeneratedPage[]; themeId: string; modeUsed: "frozen" | "guided" }> {
  const hasFrozen = template.pages_json !== null && template.pages_json !== "";

  // Decide which path to take.
  let useFrozen: boolean;
  if (mode === "frozen") {
    if (!hasFrozen) {
      throw new Error(
        "This template has no frozen HTML (spec-only). Use Guided mode.",
      );
    }
    useFrozen = true;
  } else if (mode === "guided") {
    useFrozen = false;
  } else {
    // auto: prefer frozen when available (instant + consistent), else guided.
    useFrozen = hasFrozen;
  }

  // themeId stored on the delivered sites row (record-keeping string). This
  // is distinct from the Theme.id passed to generatePages (which is "template").
  const storedThemeId = `template-${template.id}`;

  if (useFrozen) {
    // Parse the frozen pages, substitute, return.
    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(template.pages_json!) as Record<string, string>;
    } catch {
      throw new Error("Template has corrupt frozen HTML (pages_json is not valid JSON).");
    }
    const pageKeys: PageKey[] = ["home", "services", "gallery", "contact", "about"];
    const pages: GeneratedPage[] = pageKeys.map((key) => {
      const html = parsed[key];
      if (typeof html !== "string") {
        throw new Error(`Template is missing frozen HTML for the "${key}" page.`);
      }
      return {
        key,
        title: titleForKey(key),
        html: substitutePlaceholders(html, input),
      };
    });
    return { pages, themeId: storedThemeId, modeUsed: "frozen" };
  }

  // Guided: synthesize a theme from the spec, call generatePages.
  let spec: { vars: Record<string, string>; voice?: string };
  try {
    spec = JSON.parse(template.spec_json) as { vars: Record<string, string>; voice?: string };
  } catch {
    throw new Error("Template has a corrupt spec (spec_json is not valid JSON).");
  }
  if (!spec.vars || typeof spec.vars !== "object") {
    throw new Error("Template spec is missing the `vars` object.");
  }
  const theme = synthesizeTheme(spec, template.name, template.description);
  // The full Theme object is passed through GenerateOptions.theme; the id only
  // labels the stored record.
  const result = await generatePages({ input, mode: "full", themeId: theme.id, theme });
  return { pages: result.pages, themeId: storedThemeId, modeUsed: "guided" };
}

/** Human-readable title for a page key (matches the generator's PAGE_TITLES). */
function titleForKey(key: PageKey): string {
  const titles: Record<PageKey, string> = {
    home: "Home",
    services: "Services",
    gallery: "Gallery",
    contact: "Contact",
    about: "About",
  };
  return titles[key];
}
