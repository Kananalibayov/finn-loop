import assert from "node:assert/strict";
import { test } from "node:test";
import { renderHtml } from "../render/render-html.ts";
import type { DesignTokens, SectionType, SiteModel } from "../site-model.ts";
import { validateSite } from "../validate/validate.ts";
import { getRenderer } from "./registry.ts";

// Issues #216 (batch 1) and #219 (batch 2): the twelve variants styled so far,
// with the root class each block must stay inside.
const STYLED: Array<{ type: SectionType; variant: string; root: string }> = [
  { type: "services", variant: "grid", root: ".services-grid" },
  { type: "services", variant: "list", root: ".services-list" },
  { type: "features", variant: "grid", root: ".features-grid" },
  { type: "features", variant: "alternating", root: ".features-alternating" },
  { type: "about", variant: "narrative", root: ".about-narrative" },
  { type: "about", variant: "split", root: ".about-split" },
  { type: "testimonials", variant: "cards", root: ".testimonials-cards" },
  { type: "testimonials", variant: "single", root: ".testimonials-single" },
  { type: "steps", variant: "numbered", root: ".steps-numbered" },
  { type: "steps", variant: "timeline", root: ".steps-timeline" },
  { type: "gallery", variant: "grid", root: ".gallery-grid" },
  { type: "gallery", variant: "columns", root: ".gallery-columns" },
];

for (const { type, variant, root } of STYLED) {
  test(`${type}/${variant} css follows the variant conventions`, () => {
    const renderer = getRenderer(type, variant);
    assert.ok(renderer, `${type}/${variant} must be registered`);
    const css = renderer.css;
    assert.ok(css.length > 0, "css must be non-empty (no more honest stubs here)");
    assert.match(css, /container-type:\s*inline-size/, "root must be a query container");
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css), "no literal hex colours — tokens only");
    assert.ok(!css.includes("@media"), "container queries only, never viewport @media");
    assert.ok(css.includes(root), "block must style its own variant root class");
    // Every selector stays inside the variant's own BEM namespace: no reaching
    // into other sections or the page shell. At-rules are containers, not selectors.
    const selectors = css
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.includes("{") && !line.startsWith("@"))
      .map((line) => line.slice(0, line.indexOf("{")).trim())
      .filter((selector) => selector.length > 0);
    assert.ok(selectors.length > 0, "block must contain at least one rule");
    for (const selector of selectors) {
      assert.ok(
        selector.startsWith(root),
        `selector "${selector}" escapes the ${root} namespace`,
      );
    }
  });
}

const tokens: DesignTokens = {
  color: { primary: "#0f5cc0", accent: "#e8a13a", bg: "#ffffff", surface: "#f4f6f8", text: "#17202a", muted: "#5d6b7a", border: "#d8dee5" },
  font: { heading: "Inter", body: "Arial" },
  typeScale: "1.25", spacingUnit: "8px", radius: "6px", shadow: "0 1px 3px #0002", containerMax: "1100px",
};

test("a site using all twelve styled variants renders and passes every quality gate", () => {
  const model: SiteModel = {
    version: 1,
    brand: { tokens, voice: { tone: "clear" } },
    meta: { businessName: "Batch Two", contact: {}, hours: [], social: {}, locations: [] },
    nav: [{ label: "About", href: "/about" }],
    pages: [
      {
        slug: "home",
        title: "Home",
        seo: { title: "Home — Batch Two", description: "Batch Two home page.", schema: [] },
        sections: [
          { type: "hero", variant: "split", content: { heading: "Welcome" } },
          {
            type: "services",
            variant: "grid",
            content: {
              heading: "Services",
              items: [
                { title: "Design", description: "Brand and site design.", price: "From $900" },
                { title: "Build", description: "Implementation and launch." },
              ],
            },
          },
          {
            type: "features",
            variant: "alternating",
            content: {
              heading: "Why us",
              items: [
                { title: "Fast", description: "Weeks, not months." },
                { title: "Honest", description: "Gates in code, not aspirations." },
              ],
            },
          },
          {
            type: "testimonials",
            variant: "cards",
            content: {
              heading: "Clients",
              items: [
                { quote: "The site passes its own gates.", author: "Ada Lovelace", role: "CTO" },
                { quote: "Evidence in every pull request.", author: "Alan Turing" },
              ],
            },
          },
          {
            type: "steps",
            variant: "numbered",
            content: {
              heading: "How it works",
              items: [
                { title: "Brief", description: "You answer a short interview." },
                { title: "Build", description: "The generator assembles the site." },
                { title: "Launch", description: "Gates green, then publish." },
              ],
            },
          },
          {
            type: "gallery",
            variant: "grid",
            content: {
              heading: "Recent work",
              images: [
                { kind: "stock", url: "/images/work-one.jpg", alt: "Bakery storefront site", width: 800, height: 600 },
                { kind: "stock", url: "/images/work-two.jpg", alt: "Plumber landing page", width: 800, height: 600 },
              ],
            },
          },
          {
            type: "about",
            variant: "narrative",
            content: {
              heading: "Our story",
              body: ["We build sites that pass their own gates."],
              cta: { label: "About us", href: "/about" },
            },
          },
        ],
      },
      {
        slug: "about",
        title: "About",
        seo: { title: "About — Batch Two", description: "About Batch Two.", schema: [] },
        sections: [
          { type: "hero", variant: "centered", content: { heading: "About" } },
          {
            type: "services",
            variant: "list",
            content: {
              heading: "More services",
              items: [{ title: "Care", description: "Ongoing support.", price: "$90/mo" }],
            },
          },
          {
            type: "features",
            variant: "grid",
            content: {
              heading: "Capabilities",
              items: [
                { title: "Registry", description: "Fourteen section types." },
                { title: "Gates", description: "Eight blocking checks." },
              ],
            },
          },
          {
            type: "testimonials",
            variant: "single",
            content: {
              heading: "Kind words",
              items: [
                { quote: "Never report success for work that did not happen.", author: "Grace Hopper", role: "Admiral" },
              ],
            },
          },
          {
            type: "steps",
            variant: "timeline",
            content: {
              heading: "Milestones",
              items: [
                { title: "Founded", description: "The loop starts." },
                { title: "Registry", description: "Sections become composable." },
              ],
            },
          },
          {
            type: "gallery",
            variant: "columns",
            content: {
              heading: "Gallery",
              images: [
                { kind: "stock", url: "/images/gallery-one.jpg", alt: "Cafe homepage hero", width: 800, height: 600 },
                { kind: "stock", url: "/images/gallery-two.jpg", alt: "Gym pricing page", width: 800, height: 1000 },
                { kind: "stock", url: "/images/gallery-three.jpg", alt: "Florist about page", width: 800, height: 500 },
              ],
            },
          },
          {
            type: "about",
            variant: "split",
            content: {
              heading: "Principles",
              body: ["Never report success for work that did not happen."],
              cta: { label: "Home", href: "/" },
            },
          },
        ],
      },
    ],
  };
  const rendered = renderHtml(model);
  // The used variants' css actually ships in the shared stylesheet.
  assert.match(rendered.stylesheet, /\.services-grid__items/);
  assert.match(rendered.stylesheet, /\.features-alternating__index/);
  assert.match(rendered.stylesheet, /\.about-split__cta/);
  assert.match(rendered.stylesheet, /\.testimonials-cards__items/);
  assert.match(rendered.stylesheet, /\.testimonials-single__items/);
  assert.match(rendered.stylesheet, /\.steps-numbered__items/);
  assert.match(rendered.stylesheet, /\.steps-timeline__track/);
  assert.match(rendered.stylesheet, /\.gallery-grid__list/);
  assert.match(rendered.stylesheet, /\.gallery-columns__flow/);
  // And the rendered site passes the deterministic quality gates end to end.
  assert.deepEqual(validateSite(model, rendered), { ok: true, violations: [] });
});
