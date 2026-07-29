import type { DesignTokens } from "../site-model.ts";

export function tokensToCss(tokens: DesignTokens): string {
  const properties: Array<[string, string]> = [
    ["--color-primary", tokens.color.primary],
    ["--color-accent", tokens.color.accent],
    ["--color-bg", tokens.color.bg],
    ["--color-surface", tokens.color.surface],
    ["--color-text", tokens.color.text],
    ["--color-muted", tokens.color.muted],
    ["--color-border", tokens.color.border],
    ["--font-heading", tokens.font.heading],
    ["--font-body", tokens.font.body],
    ["--type-scale", tokens.typeScale],
    ["--spacing-unit", tokens.spacingUnit],
    ["--radius", tokens.radius],
    ["--shadow", tokens.shadow],
    ["--container-max", tokens.containerMax],
  ];

  return `:root {\n${properties.map(([name, value]) => `  ${name}: ${value};`).join("\n")}\n}`;
}
