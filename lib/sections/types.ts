import type { DesignTokens, SectionType } from "../site-model.ts";

export const REGISTRY_VERSION = 1;

export interface RenderContext {
  tokens: DesignTokens;
  instanceId: string;
}

export interface SectionRenderer<C> {
  readonly type: SectionType;
  readonly variant: string;
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
