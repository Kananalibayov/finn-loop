import type { PricingContent } from "../../site-model.ts";
import { escapeHtml, safeHref, type RenderContext, type SectionRenderer } from "../types.ts";

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

export const pricingCards: SectionRenderer<PricingContent> = {
  type: "pricing",
  variant: "cards",
  css: `
.pricing-cards { container-type: inline-size; }
.pricing-cards {
  display: grid;
  gap: var(--space-3);
  grid-template-columns: repeat(auto-fit, minmax(min(16rem, 100%), 1fr));
}
.pricing-cards > * + * { margin-block-start: 0; }
.pricing-cards > h2 { grid-column: 1 / -1; }
.pricing-cards__plan {
  background: var(--color-surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
}
.pricing-cards__plan > * + * { margin-block-start: var(--space-2); }
.pricing-cards__price { font-size: var(--step-2); font-weight: 700; }
.pricing-cards__period {
  color: var(--color-muted);
  font-size: var(--step-0);
  font-weight: 400;
  margin-inline-start: var(--space-1);
}
.pricing-cards__features {
  list-style: none;
  padding-inline-start: 0;
  flex-grow: 1;
}
.pricing-cards__features > * + * { margin-block-start: var(--space-1); }
.pricing-cards__cta {
  display: block;
  text-align: center;
  padding-block: var(--space-2);
  padding-inline: var(--space-4);
  background: var(--color-primary);
  color: var(--color-bg);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  text-decoration: none;
  font-weight: 600;
}
.pricing-cards__cta:hover { background: var(--color-primary-hover); }
`.trim(),
  html(content, ctx) {
    const heading = content.heading ? `<h2>${escapeHtml(content.heading)}</h2>` : "";
    const cards = content.plans.length === 0
      ? ""
      : content.plans
          .map((plan) => {
            const period = plan.period ? `<span class="pricing-cards__period">${escapeHtml(plan.period)}</span>` : "";
            const features = plan.features.length === 0
              ? ""
              : `<ul class="pricing-cards__features">${plan.features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join("")}</ul>`;
            const cta = plan.cta
              ? `<a class="pricing-cards__cta" href="${escapeHtml(safeHref(plan.cta.href))}">${escapeHtml(plan.cta.label)}</a>`
              : "";
            return `<article class="pricing-cards__plan"><h3>${escapeHtml(plan.name)}</h3><p class="pricing-cards__price">${escapeHtml(plan.price)}${period}</p>${features}${cta}</article>`;
          })
          .join("");
    return `<section class="section pricing pricing-cards" data-section-instance="${escapeHtml(ctx.instanceId)}" ${tokenAttributes(ctx)}>${heading}${cards}</section>`;
  },
};
