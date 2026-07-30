import type { FeaturesContent } from "../../site-model.ts";
import { escapeHtml, type RenderContext, type SectionRenderer } from "../types.ts";

function tokenAttributes(ctx: RenderContext): string {
  const { color, font, typeScale, spacingUnit, radius, shadow, containerMax } = ctx.tokens;
  return [
    `data-color-primary="${escapeHtml(color.primary)}"`, `data-color-accent="${escapeHtml(color.accent)}"`,
    `data-color-bg="${escapeHtml(color.bg)}"`, `data-color-surface="${escapeHtml(color.surface)}"`,
    `data-color-text="${escapeHtml(color.text)}"`, `data-color-muted="${escapeHtml(color.muted)}"`,
    `data-color-border="${escapeHtml(color.border)}"`, `data-font-heading="${escapeHtml(font.heading)}"`,
    `data-font-body="${escapeHtml(font.body)}"`, `data-type-scale="${escapeHtml(typeScale)}"`,
    `data-spacing-unit="${escapeHtml(spacingUnit)}"`, `data-radius="${escapeHtml(radius)}"`,
    `data-shadow="${escapeHtml(shadow)}"`, `data-container-max="${escapeHtml(containerMax)}"`,
  ].join(" ");
}

export const featuresAlternating: SectionRenderer<FeaturesContent> = {
  type: "features",
  variant: "alternating",
  css: `
.features-alternating { container-type: inline-size; }
.features-alternating__items { list-style: none; padding-inline-start: 0; }
.features-alternating__item {
  display: flex;
  flex-direction: column;
  padding-block: var(--space-3);
}
.features-alternating__item + .features-alternating__item {
  border-block-start: 1px solid var(--color-border);
}
.features-alternating__item > * + * { margin-block-start: var(--space-2); }
.features-alternating__index {
  order: -1;
  font-family: var(--font-heading);
  font-size: var(--step-3);
  line-height: 1;
  color: var(--color-muted);
}
@container (min-width: 40rem) {
  .features-alternating__item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
    column-gap: var(--space-3);
    align-items: start;
  }
  .features-alternating__item > * + * { margin-block-start: 0; }
  .features-alternating__item h3 { grid-column: 2; grid-row: 1; }
  .features-alternating__item p { grid-column: 2; }
  .features-alternating__index { grid-column: 1; grid-row: 1 / span 2; }
  .features-alternating__item:nth-child(even) h3 { grid-column: 1; }
  .features-alternating__item:nth-child(even) p { grid-column: 1; }
  .features-alternating__item:nth-child(even) .features-alternating__index {
    grid-column: 2;
    justify-self: end;
  }
}
`.trim(),
  html(content, ctx) {
    const heading = content.heading ? `<h2>${escapeHtml(content.heading)}</h2>` : "";
    const items = content.items.length === 0 ? "" : `<ul class="features-alternating__items">${content.items.map((item, index) => `<li class="features-alternating__item"><h3>${escapeHtml(item.title)}</h3>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}<span class="features-alternating__index" aria-hidden="true">${index + 1}</span></li>`).join("")}</ul>`;
    return `<section class="section features features-alternating" data-section-instance="${escapeHtml(ctx.instanceId)}" ${tokenAttributes(ctx)}>${heading}${items}</section>`;
  },
};
