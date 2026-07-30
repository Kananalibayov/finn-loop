import type { FaqContent } from "../../site-model.ts";
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

export const faqList: SectionRenderer<FaqContent> = {
  type: "faq",
  variant: "list",
  css: `
.faq-list { container-type: inline-size; }
.faq-list__items {
  list-style: none;
  padding-inline-start: 0;
  display: grid;
  gap: var(--space-4) var(--space-3);
  grid-template-columns: repeat(auto-fit, minmax(min(20rem, 100%), 1fr));
}
.faq-list__item > * + * { margin-block-start: var(--space-2); }
.faq-list__item h3 { font-size: var(--step-1); }
.faq-list__item p { color: var(--color-muted); }
`.trim(),
  html(content, ctx) {
    const heading = content.heading ? `<h2>${escapeHtml(content.heading)}</h2>` : "";
    const items = content.items.length === 0
      ? ""
      : `<ul class="faq-list__items">${content.items.map((item) => `<li class="faq-list__item"><h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer)}</p></li>`).join("")}</ul>`;
    return `<section class="section faq faq-list" data-section-instance="${escapeHtml(ctx.instanceId)}" ${tokenAttributes(ctx)}>${heading}${items}</section>`;
  },
};
