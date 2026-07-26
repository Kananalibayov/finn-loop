// AC-3: Three themes — one default + two alternates.
// Each theme is a set of CSS variables the LLM-generated pages reference,
// plus a short descriptor passed to the prompt so the model can match tone.

export type ThemeId = "minimal" | "warm" | "bold" | "template";

export interface Theme {
  id: ThemeId;
  name: string;
  description: string; // sent to the LLM so it can match tone/voice
  /** CSS variable values applied to :root of each generated page. */
  vars: Record<string, string>;
}

export const THEMES: Theme[] = [
  {
    id: "minimal",
    name: "Minimal (default)",
    description:
      "clean, modern, lots of whitespace, neutral gray/navy palette, sans-serif, professional and calm",
    vars: {
      "--color-bg": "#ffffff",
      "--color-text": "#1f2937",
      "--color-primary": "#2563eb",
      "--color-muted": "#6b7280",
      "--color-surface": "#f9fafb",
      "--font-sans":
        "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      "--radius": "8px",
    },
  },
  {
    id: "warm",
    name: "Warm",
    description:
      "warm and inviting, earthy palette (cream, terracotta, charcoal), soft serif headings, friendly hospitality feel",
    vars: {
      "--color-bg": "#fdf8f2",
      "--color-text": "#3a2e25",
      "--color-primary": "#c2410c",
      "--color-muted": "#8a7a6d",
      "--color-surface": "#f5ece0",
      "--font-sans":
        "'Source Serif Pro', Georgia, 'Times New Roman', serif",
      "--radius": "6px",
    },
  },
  {
    id: "bold",
    name: "Bold",
    description:
      "bold and energetic, high-contrast dark background with vivid accent, geometric, modern startup feel",
    vars: {
      "--color-bg": "#0f172a",
      "--color-text": "#e2e8f0",
      "--color-primary": "#22d3ee",
      "--color-muted": "#94a3b8",
      "--color-surface": "#1e293b",
      "--font-sans":
        "'Space Grotesk', Inter, system-ui, sans-serif",
      "--radius": "4px",
    },
  },
];

export const DEFAULT_THEME: Theme = THEMES[0];

export function getTheme(id: ThemeId): Theme {
  return THEMES.find((t) => t.id === id) ?? DEFAULT_THEME;
}
