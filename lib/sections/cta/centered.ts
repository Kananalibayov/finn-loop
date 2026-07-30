import type { CtaContent } from "../../site-model.ts";
import { escapeHtml, safeHref, type RenderContext, type SectionRenderer } from "../types.ts";

// Mirrors hero/split.ts — intentionally duplicated per the registry contract.
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

// `centered` stacks heading, optional subheading and the CTA anchor on the
// centre axis. Every visual value derives from ctx.tokens; layout is applied by
// an external stylesheet keying off the data-* attributes below.
export const ctaCentered: SectionRenderer<CtaContent> = {
  type: "cta",
  variant: "centered",
  css: `
.cta-centered { container-type: inline-size; }
.cta-centered__content {
  display: grid;
  gap: var(--space-3);
  justify-items: center;
  text-align: center;
  margin-inline: auto;
  max-inline-size: 60ch;
  background: var(--color-surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: var(--space-5) var(--space-3);
}
.cta-centered__subheading { color: var(--color-muted); }
.cta-centered__cta {
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
.cta-centered__cta:hover { background: var(--color-primary-hover); }
`.trim(),
  html(content, ctx) {
    const subheading = content.subheading
      ? `<p class="cta-centered__subheading">${escapeHtml(content.subheading)}</p>`
      : "";
    const cta = `<a class="cta-centered__cta" href="${escapeHtml(safeHref(content.cta.href))}">${escapeHtml(content.cta.label)}</a>`;
    return `<section class="section cta cta-centered" data-section-instance="${escapeHtml(ctx.instanceId)}" ${tokenAttributes(ctx)}><div class="cta-centered__content"><h2>${escapeHtml(content.heading)}</h2>${subheading}${cta}</div></section>`;
  },
};
