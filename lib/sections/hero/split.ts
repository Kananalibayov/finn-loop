import type { HeroContent } from "../../site-model.ts";
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

export const heroSplit: SectionRenderer<HeroContent> = {
  type: "hero",
  variant: "split",
  html(content, ctx) {
    const subheading = content.subheading
      ? `<p class="hero-split__subheading">${escapeHtml(content.subheading)}</p>`
      : "";
    const cta = content.cta
      ? `<a class="hero-split__cta" href="${escapeHtml(safeHref(content.cta.href))}">${escapeHtml(content.cta.label)}</a>`
      : "";
    return `<section class="section hero hero-split" data-section-instance="${escapeHtml(ctx.instanceId)}" ${tokenAttributes(ctx)}><div class="hero-split__content"><h1>${escapeHtml(content.heading)}</h1>${subheading}${cta}</div></section>`;
  },
};
