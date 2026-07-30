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

export const heroCentered: SectionRenderer<HeroContent> = {
  type: "hero",
  variant: "centered",
  css: `
.hero-centered { container-type: inline-size; }
.hero-centered__content {
  display: grid;
  gap: var(--space-3);
  justify-items: center;
  text-align: center;
  margin-inline: auto;
  max-inline-size: 60ch;
}
.hero-centered__subheading { color: var(--color-muted); font-size: var(--step-1); }
@container (max-width: 30rem) {
  .hero-centered__content { max-inline-size: 100%; }
  .hero-centered__cta { justify-self: stretch; }
}
.hero-centered__cta {
  display: inline-block;
  padding-block: var(--space-2);
  padding-inline: var(--space-4);
  background: var(--color-primary);
  color: var(--color-bg);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  text-decoration: none;
  font-weight: 600;
}
.hero-centered__cta:hover { background: var(--color-primary-hover); }
`.trim(),
  html(content, ctx) {
    const subheading = content.subheading
      ? `<p class="hero-centered__subheading">${escapeHtml(content.subheading)}</p>`
      : "";
    const cta = content.cta
      ? `<a class="hero-centered__cta" href="${escapeHtml(safeHref(content.cta.href))}">${escapeHtml(content.cta.label)}</a>`
      : "";
    return `<section class="section hero hero-centered" data-section-instance="${escapeHtml(ctx.instanceId)}" ${tokenAttributes(ctx)}><div class="hero-centered__content"><h1>${escapeHtml(content.heading)}</h1>${subheading}${cta}</div></section>`;
  },
};
