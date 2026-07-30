import type { DesignTokens, SectionType } from "../site-model.ts";

export const REGISTRY_VERSION = 1;

export interface RenderContext {
  tokens: DesignTokens;
  instanceId: string;
}

export interface SectionRenderer<C> {
  readonly type: SectionType;
  readonly variant: string;
  /**
   * Static rule block scoped to this variant's own classes. Identical for every
   * instance of the section, so it is emitted once per site no matter how many
   * times the section appears. Reads tokens via `var(--…)` — never literal values.
   * An empty string means "not styled yet" (per-section CSS is a follow-up).
   */
  readonly css: string;
  html(content: C, ctx: RenderContext): string;
}

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] ?? character,
  );
}

export function safeHref(value: string): string {
  const normalized = value.trim().replace(/[\s\u0000-\u001f\u007f]/gu, "");
  const lower = normalized.toLowerCase();

  if (
    /^(?:https?:|mailto:|tel:)/.test(lower) ||
    /^(?:\/(?!\/)|#)/.test(normalized)
  ) {
    return normalized;
  }
  return "#";
}
