import type { ContactContent } from "../../site-model.ts";
import { escapeHtml, type RenderContext, type SectionRenderer } from "../types.ts";

// Duplicated from hero/split.ts by design (NG-6): extracting the helper is a
// separate decision. Keep it local so this variant file stays self-contained.
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

// stacked: text block above the form, full width. Genuinely different layout
// from split (which places text and form side by side).
function textBlock(content: ContactContent): string {
  const body = content.body
    ? `<ul class="contact-stacked__body">${content.body
        .map((line) => `<li>${escapeHtml(line)}</li>`)
        .join("")}</ul>`
    : "";
  const heading = content.heading
    ? `<h2 class="contact-stacked__heading">${escapeHtml(content.heading)}</h2>`
    : "";
  return heading || body ? `<div class="contact-stacked__text">${heading}${body}</div>` : "";
}

function formBlock(content: ContactContent, ctx: RenderContext): string {
  if (!content.showForm) return "";
  // Ids are derived from ctx.instanceId so two contact sections on one page
  // never collide (AC-9). No action/method/JS — submission wiring is Phase 3.
  const { instanceId } = ctx;
  const nameId = `${instanceId}-name`;
  const emailId = `${instanceId}-email`;
  const messageId = `${instanceId}-message`;
  return `<form class="contact-stacked__form"><p class="contact-stacked__field"><label for="${escapeHtml(nameId)}">Name</label><input type="text" id="${escapeHtml(nameId)}" name="name" required></p><p class="contact-stacked__field"><label for="${escapeHtml(emailId)}">Email</label><input type="email" id="${escapeHtml(emailId)}" name="email" required></p><p class="contact-stacked__field"><label for="${escapeHtml(messageId)}">Message</label><textarea id="${escapeHtml(messageId)}" name="message" required></textarea></p><button type="submit">Send message</button></form>`;
}

export const contactStacked: SectionRenderer<ContactContent> = {
  type: "contact",
  variant: "stacked",
  html(content, ctx) {
    const text = textBlock(content);
    const form = formBlock(content, ctx);
    return `<section class="section contact contact-stacked" data-section-instance="${escapeHtml(ctx.instanceId)}" ${tokenAttributes(ctx)}>${text}${form}</section>`;
  },
};
