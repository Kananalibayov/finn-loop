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

// `columns` renders a CSS-columns (masonry-like) flow: items retain their
// natural aspect and the column-count/width comes from the token attributes
// below, never from a literal here. Genuinely distinct from `grid`, which uses
// even slots. No drag-only or horizontal-scroll interaction (WCAG).
function imageMarkup(image: GalleryContent["images"][number]): string {
  const src = escapeHtml(safeHref(image.url));
  const alt = escapeHtml(image.alt);
  const dimensions =
    image.width && image.height
      ? ` width="${escapeHtml(String(image.width))}" height="${escapeHtml(String(image.height))}"`
      : "";
  return `<img class="gallery-columns__image" src="${src}" alt="${alt}"${dimensions} loading="lazy">`;
}

export const galleryColumns: SectionRenderer<GalleryContent> = {
  type: "gallery",
  variant: "columns",
  html(content, ctx) {
    const heading = content.heading
      ? `<h2 class="gallery-columns__heading">${escapeHtml(content.heading)}</h2>`
      : "";
    const items = content.images
      .map((image) => `<figure class="gallery-columns__item">${imageMarkup(image)}</figure>`)
      .join("");
    // No images → no wrapper, so there is never an orphaned empty container.
    const flow = content.images.length
      ? `<div class="gallery-columns__flow">${items}</div>`
      : "";
    return `<section class="section gallery gallery-columns" data-section-instance="${escapeHtml(ctx.instanceId)}" ${tokenAttributes(ctx)}>${heading}${flow}</section>`;
  },
};
