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

export const stepsNumbered: SectionRenderer<StepsContent> = {
  type: "steps",
  variant: "numbered",
  css: `
.steps-numbered { container-type: inline-size; }
.steps-numbered__items {
  list-style: none;
  padding-inline-start: 0;
  counter-reset: step;
  display: grid;
  gap: var(--space-4) var(--space-3);
  grid-template-columns: repeat(auto-fit, minmax(min(14rem, 100%), 1fr));
}
.steps-numbered__item { counter-increment: step; }
.steps-numbered__item::before {
  content: counter(step);
  display: inline-grid;
  place-items: center;
  inline-size: var(--space-5);
  block-size: var(--space-5);
  margin-block-end: var(--space-2);
  border-radius: 50%;
  background: var(--color-primary);
  color: var(--color-bg);
  font-weight: 700;
}
.steps-numbered__item > * + * { margin-block-start: var(--space-2); }
.steps-numbered__item p { color: var(--color-muted); }
`.trim(),
  html(content, ctx) {
    const heading = content.heading ? `<h2>${escapeHtml(content.heading)}</h2>` : "";
    const items = content.items.length === 0
      ? ""
      : `<ol class="steps-numbered__items">${content.items.map((item) => `<li class="steps-numbered__item"><h3>${escapeHtml(item.title)}</h3>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}</li>`).join("")}</ol>`;
    return `<section class="section steps steps-numbered" data-section-instance="${escapeHtml(ctx.instanceId)}" ${tokenAttributes(ctx)}>${heading}${items}</section>`;
  },
};
