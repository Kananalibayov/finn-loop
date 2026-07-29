import type { Page, SiteModel } from "../site-model.ts";
import { isSiteModel } from "../site-model.ts";
import { getRenderer, sectionInstanceId } from "../sections/registry.ts";
import { escapeHtml } from "../sections/types.ts";
import { themeJson } from "./theme-json.ts";
import { tokensToCss } from "./tokens-css.ts";

export interface RenderedSite {
  stylesheet: string;
  themeJson: object;
  pages: Array<{ slug: string; html: string }>;
}

function renderPage(page: Page, model: SiteModel): string {
  const sections = page.sections.map((section, index) => {
    const renderer = getRenderer(section.type, section.variant);
    if (!renderer) {
      throw new Error(`No renderer registered for ${section.type}/${section.variant}`);
    }
    return renderer.html(section.content as never, {
      tokens: model.brand.tokens,
      instanceId: sectionInstanceId(section.type, section.variant, index),
    });
  });
  const description = page.seo.description
    ? `<meta name="description" content="${escapeHtml(page.seo.description)}">`
    : "";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(page.seo.title)}</title>${description}<link rel="stylesheet" href="/style.css"></head><body>${sections.join("")}</body></html>`;
}

export function renderHtml(model: SiteModel): RenderedSite {
  if (!isSiteModel(model)) {
    throw new TypeError("Invalid SiteModel: model does not match the required shape");
  }

  return {
    stylesheet: tokensToCss(model.brand.tokens),
    themeJson: themeJson(model.brand.tokens),
    pages: model.pages.map((page) => ({ slug: page.slug, html: renderPage(page, model) })),
  };
}
