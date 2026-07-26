// AC-2 (issue #51): data for the 3 built-in starter templates.
// This module is DATA-ONLY (no imports) so lib/db.ts can import it without a
// circular dependency. The frozen HTML is intentionally compact but complete
// and uses the same CSS-variable conventions as the generator output, so the
// pages render correctly in the existing preview iframe and are compatible
// with the future delivery flow (#54).

export type BuiltinTemplate = {
  name: string;
  description: string;
  category: string;
  /** Design spec: CSS vars (+ optional voice). Superset of the Theme concept. */
  specJson: string;
  /** Frozen HTML per page key, or null for spec-only templates. */
  pagesJson: string | null;
};

const MODERN_CLINIC_VARS = {
  "--color-bg": "#ffffff",
  "--color-text": "#0f172a",
  "--color-primary": "#0891b2",
  "--color-muted": "#64748b",
  "--color-surface": "#f1f5f9",
  "--font-sans": "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  "--radius": "10px",
};

const BISTRO_VARS = {
  "--color-bg": "#fdf8f2",
  "--color-text": "#3a2e25",
  "--color-primary": "#c2410c",
  "--color-muted": "#8a7a6d",
  "--color-surface": "#f5ece0",
  "--font-sans": "'Source Serif Pro', Georgia, 'Times New Roman', serif",
  "--radius": "6px",
};

const STARTUP_VARS = {
  "--color-bg": "#0f172a",
  "--color-text": "#e2e8f0",
  "--color-primary": "#22d3ee",
  "--color-muted": "#94a3b8",
  "--color-surface": "#1e293b",
  "--font-sans": "'Space Grotesk', Inter, system-ui, sans-serif",
  "--radius": "4px",
};

/** Build a complete 5-page frozen site with placeholders for delivery (#54).
 *  Placeholders use {{businessName}}, {{tagline}}, {{phone}}, {{email}},
 *  {{address}} — the future delivery flow substitutes these. */
function buildPages(vars: Record<string, string>, accent: string): string {
  const home = page(vars, "Home", "home", `
    <section style="padding:48px 16px;text-align:center;background:linear-gradient(135deg,var(--color-surface),var(--color-bg));">
      <h1 style="font-size:40px;margin:0 0 12px;color:${accent};">{{businessName}}</h1>
      <p style="font-size:18px;color:var(--color-muted);max-width:600px;margin:0 auto 24px;">{{tagline}}</p>
      <a href="contact.html" style="display:inline-block;padding:12px 24px;background:var(--color-primary);color:#fff;border-radius:var(--radius);text-decoration:none;font-weight:600;">Get in touch</a>
    </section>
    <section style="max-width:1100px;margin:0 auto;padding:32px 16px;">
      <p style="font-size:16px;line-height:1.7;color:var(--color-text);">Welcome to {{businessName}}. We're here to serve you.</p>
    </section>`);
  const services = page(vars, "Services", "services", `
    <section style="max-width:1100px;margin:0 auto;padding:32px 16px;">
      <h2 style="color:${accent};">Our Services</h2>
      <p style="color:var(--color-text);">What we offer at {{businessName}}.</p>
    </section>`);
  const gallery = page(vars, "Gallery", "gallery", `
    <section style="max-width:1100px;margin:0 auto;padding:32px 16px;">
      <h2 style="color:${accent};">Gallery</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-top:16px;">
        <div style="aspect-ratio:3/2;background:var(--color-surface);border-radius:var(--radius);"></div>
        <div style="aspect-ratio:3/2;background:var(--color-surface);border-radius:var(--radius);"></div>
        <div style="aspect-ratio:3/2;background:var(--color-surface);border-radius:var(--radius);"></div>
      </div>
    </section>`);
  const contact = page(vars, "Contact", "contact", `
    <section style="max-width:1100px;margin:0 auto;padding:32px 16px;">
      <h2 style="color:${accent};">Contact Us</h2>
      <p style="color:var(--color-text);">Phone: {{phone}}<br>Email: {{email}}<br>Address: {{address}}</p>
    </section>`);
  const about = page(vars, "About", "about", `
    <section style="max-width:1100px;margin:0 auto;padding:32px 16px;">
      <h2 style="color:${accent};">About {{businessName}}</h2>
      <p style="color:var(--color-text);line-height:1.7;">{{tagline}}</p>
    </section>`);
  return JSON.stringify({ home, services, gallery, contact, about });
}

/** One standalone HTML page wrapping the body with the shared shell. */
function page(vars: Record<string, string>, title: string, _key: string, body: string): string {
  const varsCss = Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — {{businessName}}</title>
<style>
:root {
${varsCss}
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--color-bg); color: var(--color-text); font-family: var(--font-sans); line-height: 1.5; }
header { display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; border-bottom: 1px solid var(--color-surface); }
header .brand { font-weight: 700; font-size: 18px; color: var(--color-primary); }
nav a { color: var(--color-muted); text-decoration: none; margin-left: 16px; font-size: 14px; }
nav a:hover { color: var(--color-primary); }
footer { padding: 24px; text-align: center; color: var(--color-muted); font-size: 13px; border-top: 1px solid var(--color-surface); margin-top: 32px; }
</style>
</head>
<body>
<header>
  <span class="brand">{{businessName}}</span>
  <nav>
    <a href="home.html">Home</a>
    <a href="services.html">Services</a>
    <a href="gallery.html">Gallery</a>
    <a href="contact.html">Contact</a>
    <a href="about.html">About</a>
  </nav>
</header>
<main>${body}</main>
<footer>{{phone}} · {{email}}</footer>
</body>
</html>`;
}

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    name: "Modern Clinic",
    description: "Professional, clean, cool-blue palette. Suited for clinics, professional services, and consultancies.",
    category: "professional",
    specJson: JSON.stringify({ vars: MODERN_CLINIC_VARS, voice: "professional, calm, reassuring, trustworthy" }),
    pagesJson: buildPages(MODERN_CLINIC_VARS, "var(--color-primary)"),
  },
  {
    name: "Bistro Warmth",
    description: "Warm, earthy, inviting. Suited for restaurants, cafés, hospitality, and food businesses.",
    category: "restaurant",
    specJson: JSON.stringify({ vars: BISTRO_VARS, voice: "warm, inviting, sensory, friendly" }),
    pagesJson: buildPages(BISTRO_VARS, "var(--color-primary)"),
  },
  {
    name: "Bold Startup",
    description: "Dark, high-contrast, energetic. Spec-only (no frozen HTML) — every delivery is LLM-guided. Suited for tech startups and SaaS.",
    category: "tech",
    specJson: JSON.stringify({ vars: STARTUP_VARS, voice: "bold, energetic, confident, modern" }),
    pagesJson: null, // spec-only — demonstrates the guided-delivery path
  },
];
