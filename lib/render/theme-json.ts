import type { DesignTokens } from "../site-model.ts";

export function themeJson(tokens: DesignTokens): object {
  return {
    $schema: "https://schemas.wp.org/wp/6.1/theme.json",
    version: 2,
    settings: {
      color: {
        palette: [
          { slug: "primary", color: tokens.color.primary, name: "Primary" },
          { slug: "accent", color: tokens.color.accent, name: "Accent" },
          { slug: "background", color: tokens.color.bg, name: "Background" },
          { slug: "surface", color: tokens.color.surface, name: "Surface" },
          { slug: "text", color: tokens.color.text, name: "Text" },
          { slug: "muted", color: tokens.color.muted, name: "Muted" },
          { slug: "border", color: tokens.color.border, name: "Border" },
        ],
      },
      typography: {
        fontFamilies: [
          { slug: "heading", fontFamily: tokens.font.heading, name: "Heading" },
          { slug: "body", fontFamily: tokens.font.body, name: "Body" },
        ],
      },
    },
  };
}
