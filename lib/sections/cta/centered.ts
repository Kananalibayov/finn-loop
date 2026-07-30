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
  css: "",
  html(content, ctx) {
    const subheading = content.subheading
      ? `<p class="cta-centered__subheading">${escapeHtml(content.subheading)}</p>`
      : "";
    const cta = `<a class="cta-centered__cta" href="${escapeHtml(safeHref(content.cta.href))}">${escapeHtml(content.cta.label)}</a>`;
    return `<section class="section cta cta-centered" data-section-instance="${escapeHtml(ctx.instanceId)}" ${tokenAttributes(ctx)}><div class="cta-centered__content"><h2>${escapeHtml(content.heading)}</h2>${subheading}${cta}</div></section>`;
  },
};
