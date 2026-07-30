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

  // Computed from the declared tokens so variants never do arithmetic inline.
  // Spacing ladder: multiples of the site spacing unit.
  // Type ladder: fluid sizes — clamp() around the site type scale and a
  // viewport term, so type grows smoothly with both the container and the
  // site's chosen scale. Derived colours: color-mix() shades of the palette.
  const computed: Array<[string, string]> = [
    ["--space-1", "calc(var(--spacing-unit) * 1)"],
    ["--space-2", "calc(var(--spacing-unit) * 2)"],
    ["--space-3", "calc(var(--spacing-unit) * 3)"],
    ["--space-4", "calc(var(--spacing-unit) * 4)"],
    ["--space-5", "calc(var(--spacing-unit) * 6)"],
    ["--space-6", "calc(var(--spacing-unit) * 8)"],
    ["--step-0", "clamp(1rem, calc(0.8rem * var(--type-scale) + 0.2vw), 1.125rem)"],
    ["--step-1", "clamp(1.15rem, calc(0.95rem * var(--type-scale) + 0.35vw), 1.5rem)"],
    ["--step-2", "clamp(1.35rem, calc(1.05rem * var(--type-scale) + 0.6vw), 1.9rem)"],
    ["--step-3", "clamp(1.6rem, calc(1.2rem * var(--type-scale) + 0.9vw), 2.4rem)"],
    ["--step-4", "clamp(1.9rem, calc(1.35rem * var(--type-scale) + 1.3vw), 3rem)"],
    ["--color-primary-hover", "color-mix(in oklab, var(--color-primary) 85%, black)"],
    ["--focus-ring", "color-mix(in oklab, var(--color-primary) 75%, var(--color-text))"],
  ];

  return `:root {\n${[...properties, ...computed].map(([name, value]) => `  ${name}: ${value};`).join("\n")}\n}`;
}
