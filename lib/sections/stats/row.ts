import type { StatsContent } from "../../site-model.ts";
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

export const statsRow: SectionRenderer<StatsContent> = {
  type: "stats",
  variant: "row",
  css: `
.stats-row { container-type: inline-size; }
.stats-row__items {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-4);
}
.stats-row__item { text-align: center; }
.stats-row__item > * + * { margin-block-start: var(--space-1); }
@container (min-width: 40rem) {
  .stats-row__items > * + * {
    border-inline-start: 1px solid var(--color-border);
    padding-inline-start: var(--space-4);
  }
}
.stats-row__value {
  font-family: var(--font-heading);
  font-size: var(--step-2);
  font-weight: 700;
}
.stats-row__label { color: var(--color-muted); }
`.trim(),
  html(content, ctx) {
    const heading = content.heading ? `<h2>${escapeHtml(content.heading)}</h2>` : "";
    const items = content.items.length === 0 ? "" : `<dl class="stats-row__items">${content.items.map((item) => `<div class="stats-row__item"><dt class="stats-row__value">${escapeHtml(item.value)}</dt><dd class="stats-row__label">${escapeHtml(item.label)}</dd></div>`).join("")}</dl>`;
    return `<section class="section stats stats-row" data-section-instance="${escapeHtml(ctx.instanceId)}" ${tokenAttributes(ctx)}>${heading}${items}</section>`;
  },
};
