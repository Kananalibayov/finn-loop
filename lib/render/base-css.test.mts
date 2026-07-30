import assert from "node:assert/strict";
import { test } from "node:test";
import type { DesignTokens, SiteModel } from "../site-model.ts";
import { collectCss, getRenderer } from "../sections/registry.ts";
import { BASE_CSS } from "./base-css.ts";
import { tokensToCss } from "./tokens-css.ts";
import { renderHtml } from "./render-html.ts";

const tokens: DesignTokens = {
  color: {
    primary: "#123456",
    accent: "#abcdef",
    bg: "#ffffff",
    surface: "#f5f5f5",
    text: "#111111",
    muted: "#666666",
    border: "#dddddd",
  },
  font: { heading: "Inter", body: "Arial" },
  typeScale: "1.25",
  spacingUnit: "8px",
  radius: "4px",
  shadow: "0 1px 2px #0003",
  containerMax: "1200px",
};

function siteWithSections(sections: Array<{ type: "hero"; variant: string }>): SiteModel {
  return {
    version: 1,
    brand: { tokens, voice: { tone: "clear" } },
    meta: { businessName: "Example", contact: {}, hours: [], social: {}, locations: [] },
    nav: [],
    pages: [{
      slug: "home",
      title: "home",
      seo: { title: "home", description: "", schema: [] },
      sections: sections.map((s) => ({ type: s.type, variant: s.variant, content: { heading: "Hi" } })),
    }],
  };
}

test("collectCss dedupes by type/variant and is deterministic (AC-2)", () => {
  const used = [
    { type: "hero" as const, variant: "split" },
    { type: "hero" as const, variant: "split" },
    { type: "hero" as const, variant: "centered" },
  ];
  const css = collectCss(used);
  assert.equal(css.split(".hero-split__content").length - 1 > 0, true);
  assert.equal(css.split(".hero-split {").length - 1, 1, "split css emitted exactly once");
  assert.equal(css.split(".hero-centered {").length - 1, 1, "centered css emitted exactly once");
  assert.equal(collectCss(used), collectCss(used), "same input → byte-identical output");
  const reversed = collectCss([...used].reverse());
  assert.equal(reversed, css, "registry order, not usage order");
});

test("collectCss handles empty and unknown input without throwing (AC-3)", () => {
  assert.equal(collectCss([]), "");
  assert.equal(collectCss([{ type: "hero", variant: "nope" }]), "");
});

test("hero variants carry non-empty css with container queries (AC-10)", () => {
  for (const variant of ["split", "centered"] as const) {
    const renderer = getRenderer("hero", variant)!;
    assert.ok(renderer.css.length > 0);
    assert.ok(renderer.css.includes("@container"), `${variant} uses @container`);
    assert.ok(renderer.css.includes("container-type: inline-size"), `${variant} root declares the query container`);
    assert.ok(!renderer.css.includes("@media (min-width"), `${variant} has no viewport media query`);
  }
});

test("renderHtml stylesheet composes tokens, base layer, then used-variant css (AC-4, AC-5)", () => {
  const result = renderHtml(siteWithSections([{ type: "hero", variant: "split" }]));
  const rootBlock = result.stylesheet.indexOf(":root {");
  const baseRule = result.stylesheet.indexOf("box-sizing: border-box");
  const heroRule = result.stylesheet.indexOf(".hero-split__content");
  assert.ok(rootBlock !== -1 && baseRule !== -1 && heroRule !== -1);
  assert.ok(rootBlock < baseRule && baseRule < heroRule, "tokens → base → variant order");
  assert.ok(!result.stylesheet.includes(".hero-centered__content"), "unused variant css is not emitted");
});

test("stylesheet exposes the computed token properties", () => {
  const css = tokensToCss(tokens);
  for (const name of ["--space-1", "--space-6", "--step-0", "--step-4", "--color-primary-hover", "--focus-ring"]) {
    assert.match(css, new RegExp(`${name}:`), `${name} present`);
  }
  assert.match(css, /clamp\(/);
  assert.match(css, /color-mix\(in oklab/);
  // the 14 declared properties are still first-class and first in order
  assert.ok(css.indexOf("--color-primary") < css.indexOf("--space-1"));
  assert.match(css, /--color-primary: #123456;/);
});

test("BASE_CSS enforces visible focus and never removes outlines (AC-7)", () => {
  assert.match(BASE_CSS, /:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--focus-ring\)/);
  assert.ok(!BASE_CSS.includes("outline: none") && !BASE_CSS.includes("outline:none"));
});

test("BASE_CSS kills image CLS and respects reduced motion (AC-8)", () => {
  assert.match(BASE_CSS, /img \{ max-width: 100%[^}]*\}/);
  assert.match(BASE_CSS, /@media \(prefers-reduced-motion: reduce\)/);
});

test("BASE_CSS uses logical properties, never physical ones (AC-9)", () => {
  assert.ok(BASE_CSS.includes("padding-block"));
  assert.ok(BASE_CSS.includes("margin-inline"));
  assert.ok(!BASE_CSS.includes("padding-top") && !BASE_CSS.includes("margin-left"));
});

test("rendered page html carries no inline styling or scripts (AC-11)", () => {
  const result = renderHtml(siteWithSections([
    { type: "hero", variant: "split" },
    { type: "hero", variant: "centered" },
  ]));
  for (const page of result.pages) {
    assert.ok(!page.html.includes("<style"), "no <style> block");
    assert.ok(!page.html.includes('style="'), "no style= attribute");
    assert.ok(!page.html.includes("<script"), "no <script>");
  }
});
