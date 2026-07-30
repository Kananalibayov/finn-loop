import type { AboutContent } from "../../site-model.ts";
import { escapeHtml, safeHref, type RenderContext, type SectionRenderer } from "../types.ts";

function tokenAttributes(ctx: RenderContext): string {
  const { color, font, typeScale, spacingUnit, radius, shadow, containerMax } = ctx.tokens;
  return [
    `data-color-primary="${escapeHtml(color.primary)}"`,
    `data-color-accent="${escapeHtml(color.accent)}"`,
    `data-color-bg="${escapeHtml(color.bg)}"`,
    `data-color-surface="${escapeHtml(color.surface)}"`,
    `data-color-text="${escapeHtml(color.text)}"`,
    `data-color-muted="${escapeHtml(color.muted)}"`,
    `data-color-border="${escapeHtml(color.border)}"`,
    `data-font-heading="${escapeHtml(font.heading)}"`,
    `data-font-body="${escapeHtml(font.body)}"`,
    `data-type-scale="${escapeHtml(typeScale)}"`,
    `data-spacing-unit="${escapeHtml(spacingUnit)}"`,
    `data-radius="${escapeHtml(radius)}"`,
    `data-shadow="${escapeHtml(shadow)}"`,
    `data-container-max="${escapeHtml(containerMax)}"`,
  ].join(" ");
}

export const aboutNarrative: SectionRenderer<AboutContent> = {
  type: "about",
  variant: "narrative",
  css: "",
  html(content, ctx) {
    const body = content.body
      .map((paragraph) => `<p class="about-narrative__body">${escapeHtml(paragraph)}</p>`)
      .join("");
    const cta = content.cta
      ? `<a class="about-narrative__cta" href="${escapeHtml(safeHref(content.cta.href))}">${escapeHtml(content.cta.label)}</a>`
      : "";
    return `<section class="section about about-narrative" data-section-instance="${escapeHtml(ctx.instanceId)}" ${tokenAttributes(ctx)}><div class="about-narrative__content"><h2>${escapeHtml(content.heading)}</h2>${body}${cta}</div></section>`;
  },
};
