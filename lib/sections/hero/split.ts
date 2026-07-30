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
  css: `
.hero-split { container-type: inline-size; }
.hero-split__content { display: grid; gap: var(--space-3); }
@container (min-width: 40rem) {
  .hero-split__content { grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); align-items: start; }
}
.hero-split__subheading { color: var(--color-muted); font-size: var(--step-1); }
.hero-split__cta {
  display: inline-block;
  padding-block: var(--space-2);
  padding-inline: var(--space-4);
  background: var(--color-primary);
  color: var(--color-bg);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  text-decoration: none;
  font-weight: 600;
  justify-self: start;
}
.hero-split__cta:hover { background: var(--color-primary-hover); }
`.trim(),
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
