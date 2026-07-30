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
