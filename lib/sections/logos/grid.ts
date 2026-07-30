import type { LogosContent } from "../../site-model.ts";
import { escapeHtml, safeHref, type RenderContext, type SectionRenderer } from "../types.ts";

// Local copy of the hero tokenAttributes helper (NG-6: duplication accepted for now;
// extracting it is a separate decision, do not export from types.ts as part of this issue).
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

function renderLogo(image: LogosContent["images"][number], className: string): string {
  const dimensions =
    image.width && image.height
      ? ` width="${escapeHtml(String(image.width))}" height="${escapeHtml(String(image.height))}"`
      : "";
  // alt is required on MediaRef — never omit the attribute, never emit alt="".
  return `<img class="${className}" src="${escapeHtml(safeHref(image.url))}" alt="${escapeHtml(image.alt)}" loading="lazy"${dimensions}>`;
}

// grid: an even multi-row grid of logos. Layout is expressed through distinct classes
// + semantic <ul>/<li> structure, not inline styles (Constraint 5). No JS (Constraint 8).
export const logosGrid: SectionRenderer<LogosContent> = {
  type: "logos",
  variant: "grid",
  css: "",
  html(content, ctx) {
    const heading = content.heading ? `<h2>${escapeHtml(content.heading)}</h2>` : "";
    const list =
      content.images.length === 0
        ? ""
        : `<ul class="logos-grid__list">${content.images
            .map((image) => `<li class="logos-grid__item">${renderLogo(image, "logos-grid__logo")}</li>`)
            .join("")}</ul>`;
    return `<section class="section logos logos-grid" data-section-instance="${escapeHtml(ctx.instanceId)}" ${tokenAttributes(ctx)}>${heading}${list}</section>`;
  },
};
