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
  return `<img class="team-rows__photo" src="${escapeHtml(safeHref(url))}" alt="${escapeHtml(alt)}" loading="lazy"${dims}>`;
}

function renderMember(member: TeamMember): string {
  const photo = member.photo
    ? renderPhoto(member.photo.url, member.photo.alt, member.photo.width, member.photo.height)
    : "";
  const role = member.role ? `<p class="team-rows__role">${escapeHtml(member.role)}</p>` : "";
  const bio = member.bio ? `<p class="team-rows__bio">${escapeHtml(member.bio)}</p>` : "";
  const body = `<div class="team-rows__body"><h3 class="team-rows__name">${escapeHtml(
    member.name,
  )}</h3>${role}${bio}</div>`;
  return `<article class="team-rows__member">${photo}${body}</article>`;
}

export const teamRows: SectionRenderer<TeamContent> = {
  type: "team",
  variant: "rows",
  html(content, ctx) {
    const heading = content.heading
      ? `<h2 class="team-rows__heading">${escapeHtml(content.heading)}</h2>`
      : "";
    const list =
      content.members.length > 0
        ? `<ul class="team-rows__list">${content.members
            .map((member) => `<li class="team-rows__item">${renderMember(member)}</li>`)
            .join("")}</ul>`
        : "";
    return `<section class="section team team-rows" data-section-instance="${escapeHtml(ctx.instanceId)}" ${tokenAttributes(ctx)}><div class="team-rows__container">${heading}${list}</div></section>`;
  },
};
