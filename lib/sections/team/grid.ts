import type { TeamContent, TeamMember } from "../../site-model.ts";
import { escapeHtml, safeHref, type RenderContext, type SectionRenderer } from "../types.ts";

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

function renderPhoto(url: string, alt: string, width?: number, height?: number): string {
  const dims =
    width !== undefined && height !== undefined
      ? ` width="${escapeHtml(String(width))}" height="${escapeHtml(String(height))}"`
      : "";
  return `<img class="team-grid__photo" src="${escapeHtml(safeHref(url))}" alt="${escapeHtml(alt)}" loading="lazy"${dims}>`;
}

function renderMember(member: TeamMember): string {
  const photo = member.photo
    ? renderPhoto(member.photo.url, member.photo.alt, member.photo.width, member.photo.height)
    : "";
  const role = member.role ? `<p class="team-grid__role">${escapeHtml(member.role)}</p>` : "";
  const bio = member.bio ? `<p class="team-grid__bio">${escapeHtml(member.bio)}</p>` : "";
  return `<article class="team-grid__member">${photo}<h3 class="team-grid__name">${escapeHtml(member.name)}</h3>${role}${bio}</article>`;
}

export const teamGrid: SectionRenderer<TeamContent> = {
  type: "team",
  variant: "grid",
  css: `
.team-grid { container-type: inline-size; }
.team-grid__list {
  list-style: none;
  padding-inline-start: 0;
  display: grid;
  gap: var(--space-4) var(--space-3);
  grid-template-columns: repeat(auto-fit, minmax(min(14rem, 100%), 1fr));
}
.team-grid__member { text-align: center; }
.team-grid__member > * + * { margin-block-start: var(--space-2); }
.team-grid__photo {
  inline-size: calc(var(--space-6) * 2);
  block-size: calc(var(--space-6) * 2);
  object-fit: cover;
  border-radius: 50%;
  margin-inline: auto;
}
.team-grid__name { font-size: var(--step-1); }
.team-grid__role { color: var(--color-muted); }
.team-grid__bio { color: var(--color-muted); }
`.trim(),
  html(content, ctx) {
    const heading = content.heading
      ? `<h2 class="team-grid__heading">${escapeHtml(content.heading)}</h2>`
      : "";
    const list =
      content.members.length > 0
        ? `<ul class="team-grid__list">${content.members
            .map((member) => `<li class="team-grid__item">${renderMember(member)}</li>`)
            .join("")}</ul>`
        : "";
    return `<section class="section team team-grid" data-section-instance="${escapeHtml(ctx.instanceId)}" ${tokenAttributes(ctx)}><div class="team-grid__container">${heading}${list}</div></section>`;
  },
};
