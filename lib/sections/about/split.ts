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

export const aboutSplit: SectionRenderer<AboutContent> = {
  type: "about",
  variant: "split",
  css: `
.about-split { container-type: inline-size; }
.about-split__body-column > * + * { margin-block-start: var(--space-2); }
.about-split__cta {
  display: inline-block;
  margin-block-start: var(--space-2);
  padding-block: var(--space-2);
  padding-inline: var(--space-4);
  background: var(--color-primary);
  color: var(--color-bg);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  text-decoration: none;
  font-weight: 600;
}
.about-split__cta:hover { background: var(--color-primary-hover); }
@container (min-width: 40rem) {
  .about-split {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
    gap: var(--space-4);
    align-items: start;
  }
  .about-split > * { max-inline-size: none; margin-inline: 0; }
}
`.trim(),
  html(content, ctx) {
    const body = content.body
      .map((paragraph) => `<p class="about-split__body">${escapeHtml(paragraph)}</p>`)
      .join("");
    const cta = content.cta
      ? `<a class="about-split__cta" href="${escapeHtml(safeHref(content.cta.href))}">${escapeHtml(content.cta.label)}</a>`
      : "";
    return `<section class="section about about-split" data-section-instance="${escapeHtml(ctx.instanceId)}" ${tokenAttributes(ctx)}><div class="about-split__heading"><h2>${escapeHtml(content.heading)}</h2></div><div class="about-split__body-column">${body}${cta}</div></section>`;
  },
};
