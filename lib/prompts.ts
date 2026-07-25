// Prompt construction for the OpenAI generator.
// One builder function per page so each call is focused and small.

import { BusinessInput, PageKey } from "./types";
import { Theme } from "./themes";

const SHARED_RULES = `You are a senior web designer generating one standalone HTML page for a small business website.
Rules:
- Output ONLY the HTML document. No markdown fences, no commentary, no wrapping.
- Use semantic HTML5 (header, nav, main, section, footer, article).
- Link the 5 pages with these hrefs: index.html (Home), services.html (Services), gallery.html (Gallery), contact.html (Contact), about.html (About).
- Every page must include a header with the business name/logo and a nav, and a footer with the contact details.
- Use CSS variables (var(--color-bg), var(--color-text), var(--color-primary), var(--color-muted), var(--color-surface), var(--font-sans), var(--radius)) so the theme controls look.
- Inline a small <style> block that defines :root with those variables and basic layout rules (container max-width 1100px, responsive). Do NOT use external CSS files.
- Do not use any external JS or CDNs. No images other than the provided logo URL or https://picsum.photos placeholders.
- Tone must match the requested theme description.`;

function inputBlock(input: BusinessInput, defaults: { logo: string; colors: string }): string {
  return `BUSINESS INFO:
- Business name: ${input.businessName}
- Tagline: ${input.tagline}
- Description: ${input.description}
- Services: ${input.services.map((s) => `- ${s}`).join("\n") || "- (none provided; invent 3 plausible services)"}
- Phone: ${input.phone}
- Email: ${input.email}
- Address: ${input.address}
- Logo URL: ${input.logoUrl || defaults.logo}
- Brand colors: ${input.brandColors || defaults.colors}`;
}

function defaultsFor(input: BusinessInput) {
  return {
    logo: input.logoUrl
      ? input.logoUrl
      : `https://dummyimage.com/180x60/${"2563eb"}/ffffff.png&text=${encodeURIComponent(
          input.businessName,
        )}`,
    colors: input.brandColors || "(use the theme's default palette)",
  };
}

export function buildPrompt(
  page: PageKey,
  input: BusinessInput,
  theme: Theme,
): { system: string; user: string; defaults: { logo: boolean; colors: boolean } } {
  const d = defaultsFor(input);
  const system = `${SHARED_RULES}

THEME: "${theme.name}" — ${theme.description}

THEME VARIABLES (use exactly these in :root):
${Object.entries(theme.vars)
  .map(([k, v]) => `  ${k}: ${v};`)
  .join("\n")}`;

  const pageSpec: Record<PageKey, string> = {
    home:
      "Generate the HOME page (index.html). Include a hero section with tagline + CTA button, a short intro paragraph from the description, a 3-card preview of the services, and contact details in the footer.",
    services:
      "Generate the SERVICES page (services.html). List each service as a card or section with a title and a one-sentence description derived from the business description. No pricing unless the business info includes it.",
    gallery:
      "Generate the GALLERY page (gallery.html). Show a responsive grid of 6 placeholder images using https://picsum.photos/seed/N/600/400 with descriptive alt text related to the business. Do not claim they are real photos.",
    contact:
      "Generate the CONTACT page (contact.html). Show the phone, email, and address prominently, a simple contact form (name, email, message, submit) — the form does not need to function — and a small map placeholder link.",
    about:
      "Generate the ABOUT page (about.html). Write a 2-3 paragraph company story derived from the description and tagline, a short values list, and a call to contact the business.",
  };

  const user = `${inputBlock(input, d)}

TASK: ${pageSpec[page]}`;

  return {
    system,
    user,
    defaults: { logo: !input.logoUrl, colors: !input.brandColors },
  };
}

// Strip markdown fences if the model adds them despite instructions.
export function cleanHtml(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/i, "");
  }
  return s.trim();
}
