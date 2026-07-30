import type { StepsContent } from "../../site-model.ts";
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

export const stepsTimeline: SectionRenderer<StepsContent> = {
  type: "steps",
  variant: "timeline",
  css: `
.steps-timeline { container-type: inline-size; }
.steps-timeline__track {
  border-inline-start: 2px solid var(--color-border);
  padding-inline-start: var(--space-4);
}
.steps-timeline__items {
  list-style: none;
  padding-inline-start: 0;
  display: grid;
  gap: var(--space-4);
}
.steps-timeline__node { position: relative; }
.steps-timeline__node::before {
  content: "";
  position: absolute;
  inset-inline-start: calc(-1 * var(--space-4) - 1px - var(--space-2) / 2);
  inset-block-start: var(--space-1);
  inline-size: var(--space-2);
  block-size: var(--space-2);
  border-radius: 50%;
  background: var(--color-primary);
}
.steps-timeline__node > * + * { margin-block-start: var(--space-1); }
.steps-timeline__node p { color: var(--color-muted); }
`.trim(),
  html(content, ctx) {
    const heading = content.heading ? `<h2>${escapeHtml(content.heading)}</h2>` : "";
    const items = content.items.length === 0
      ? ""
      : `<div class="steps-timeline__track"><ol class="steps-timeline__items">${content.items.map((item) => `<li class="steps-timeline__node"><h3>${escapeHtml(item.title)}</h3>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}</li>`).join("")}</ol></div>`;
    return `<section class="section steps steps-timeline" data-section-instance="${escapeHtml(ctx.instanceId)}" ${tokenAttributes(ctx)}>${heading}${items}</section>`;
  },
};
