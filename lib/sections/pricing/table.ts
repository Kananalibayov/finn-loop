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

export const pricingTable: SectionRenderer<PricingContent> = {
  type: "pricing",
  variant: "table",
  css: "",
  html(content, ctx) {
    const heading = content.heading ? `<h2>${escapeHtml(content.heading)}</h2>` : "";
    const plans = content.plans;

    if (plans.length === 0) {
      return `<section class="section pricing pricing-table" data-section-instance="${escapeHtml(ctx.instanceId)}" ${tokenAttributes(ctx)}>${heading}</section>`;
    }

    // Header row: one plan name per column. A leading corner cell keeps every
    // row's column count aligned with the row-header column in the body.
    const headerCells = plans
      .map((plan) => `<th scope="col">${escapeHtml(plan.name)}</th>`)
      .join("");

    // Price row: rendered verbatim (pre-formatted upstream), with optional period.
    const priceCells = plans
      .map((plan) => {
        const period = plan.period ? ` <span class="pricing-table__period">${escapeHtml(plan.period)}</span>` : "";
        return `<td>${escapeHtml(plan.price)}${period}</td>`;
      })
      .join("");

    // CTA row: optional, one cell per plan (empty cell preserves column count).
    const anyCta = plans.some((plan) => plan.cta);
    const ctaRow = anyCta
      ? `<tr>${plans
          .map((plan) =>
            plan.cta
              ? `<td><a class="pricing-table__cta" href="${escapeHtml(safeHref(plan.cta.href))}">${escapeHtml(plan.cta.label)}</a></td>`
              : "<td></td>",
          )
          .join("")}</tr>`
      : "";

    // Feature rows: the union of every plan's features, each labelled in a
    // row-header cell so the table reads as a comparison grid.
    const featureLabels = new Set<string>();
    for (const plan of plans) {
      for (const feature of plan.features) featureLabels.add(feature);
    }
    const featureRows = [...featureLabels]
      .map(
        (feature) =>
          `<tr><th scope="row">${escapeHtml(feature)}</th>${plans
            .map((plan) => `<td>${plan.features.includes(feature) ? "✓" : ""}</td>`)
            .join("")}</tr>`,
      )
      .join("");

    const table = `<table class="pricing-table__table"><thead><tr><th scope="col" class="pricing-table__corner"></th>${headerCells}</tr></thead><tbody><tr><th scope="row">${escapeHtml("Price")}</th>${priceCells}</tr>${featureRows}${ctaRow}</tbody></table>`;

    return `<section class="section pricing pricing-table" data-section-instance="${escapeHtml(ctx.instanceId)}" ${tokenAttributes(ctx)}>${heading}${table}</section>`;
  },
};
