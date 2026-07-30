import type { GalleryContent } from "../../site-model.ts";
import { escapeHtml, safeHref, type RenderContext, type SectionRenderer } from "../types.ts";

// Mirrors hero/split.ts — intentionally duplicated per the registry contract.
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

// `grid` renders an even responsive grid: every cell takes the same slot, flowed
// by an external stylesheet that keys off the data-* token attributes below.
// No layout value is hardcoded here — all visuals derive from ctx.tokens.
function imageMarkup(image: GalleryContent["images"][number]): string {
  const src = escapeHtml(safeHref(image.url));
  const alt = escapeHtml(image.alt);
  const dimensions =
    image.width && image.height
      ? ` width="${escapeHtml(String(image.width))}" height="${escapeHtml(String(image.height))}"`
      : "";
  return `<img class="gallery-grid__image" src="${src}" alt="${alt}"${dimensions} loading="lazy">`;
}

export const galleryGrid: SectionRenderer<GalleryContent> = {
  type: "gallery",
  variant: "grid",
  html(content, ctx) {
    const heading = content.heading
      ? `<h2 class="gallery-grid__heading">${escapeHtml(content.heading)}</h2>`
      : "";
    const items = content.images
      .map((image) => `<li class="gallery-grid__item">${imageMarkup(image)}</li>`)
      .join("");
    // No images → no list, so there is never an orphaned empty <ul>.
    const list = content.images.length ? `<ul class="gallery-grid__list">${items}</ul>` : "";
    return `<section class="section gallery gallery-grid" data-section-instance="${escapeHtml(ctx.instanceId)}" ${tokenAttributes(ctx)}>${heading}${list}</section>`;
  },
};
