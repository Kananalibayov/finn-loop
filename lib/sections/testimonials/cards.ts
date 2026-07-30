import type { TestimonialsContent } from "../../site-model.ts";
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

export const testimonialsCards: SectionRenderer<TestimonialsContent> = {
  type: "testimonials",
  variant: "cards",
  css: `
.testimonials-cards { container-type: inline-size; }
.testimonials-cards__items {
  list-style: none;
  padding-inline-start: 0;
  display: grid;
  gap: var(--space-3);
  grid-template-columns: repeat(auto-fit, minmax(min(18rem, 100%), 1fr));
}
.testimonials-cards__item {
  background: var(--color-surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: var(--space-3);
}
.testimonials-cards__item > * + * { margin-block-start: var(--space-2); }
.testimonials-cards__item blockquote {
  padding-inline-start: var(--space-2);
  border-inline-start: 2px solid var(--color-primary);
}
.testimonials-cards__item cite { font-style: normal; font-weight: 600; }
.testimonials-cards__item cite + p { color: var(--color-muted); }
`.trim(),
  html(content, ctx) {
    const heading = content.heading ? `<h2>${escapeHtml(content.heading)}</h2>` : "";
    const items = content.items.length === 0 ? "" : `<ul class="testimonials-cards__items">${content.items.map((item) => `<li class="testimonials-cards__item"><blockquote>${escapeHtml(item.quote)}</blockquote><cite>${escapeHtml(item.author)}</cite>${item.role ? `<p>${escapeHtml(item.role)}</p>` : ""}</li>`).join("")}</ul>`;
    return `<section class="section testimonials testimonials-cards" data-section-instance="${escapeHtml(ctx.instanceId)}" ${tokenAttributes(ctx)}>${heading}${items}</section>`;
  },
};
