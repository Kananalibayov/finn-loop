import assert from "node:assert/strict";
import { test } from "node:test";
import type { DesignTokens, SiteModel } from "../site-model.ts";
import { sectionInstanceId } from "../sections/registry.ts";
import { renderHtml } from "./render-html.ts";
import { themeJson } from "./theme-json.ts";
import { tokensToCss } from "./tokens-css.ts";

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

function modelWithPages(): SiteModel {
  const page = (slug: string, count = 1) => ({
    slug,
    title: slug,
    seo: { title: `${slug} <title>`, description: `${slug} & description`, schema: [] },
    sections: Array.from({ length: count }, (_, index) => ({
      type: "hero" as const,
      variant: index % 2 === 0 ? "split" : "centered",
      content: { heading: `Heading ${index}` },
    })),
  });
  return {
    version: 1,
    brand: { tokens, voice: { tone: "clear" } },
    meta: { businessName: "Example", contact: {}, hours: [], social: {}, locations: [] },
    nav: [],
    pages: [page("home", 2), page("about")],
  };
}

test("tokensToCss emits every deterministic custom property", () => {
  const css = tokensToCss(tokens);
  for (const name of [
    "--color-primary", "--color-accent", "--color-bg", "--color-surface", "--color-text",
    "--color-muted", "--color-border", "--font-heading", "--font-body", "--type-scale",
    "--spacing-unit", "--radius", "--shadow", "--container-max",
  ]) assert.match(css, new RegExp(`${name}:`));
  assert.match(css, /--color-primary: #123456;/);
});

test("themeJson exposes WordPress v2 palette and font families", () => {
  const result = themeJson(tokens) as { version: number; settings: { color: { palette: Array<{ color: string }> }; typography: { fontFamilies: unknown[] } } };
  assert.equal(result.version, 2);
  assert.equal(result.settings.color.palette.some((entry) => entry.color === tokens.color.primary), true);
  assert.equal(result.settings.typography.fontFamilies.length, 2);
});

test("renderHtml preserves page order and emits one external stylesheet per page", () => {
  const result = renderHtml(modelWithPages());
  assert.deepEqual(result.pages.map((page) => page.slug), ["home", "about"]);
  assert.equal(result.pages.length, 2);
  for (const page of result.pages) {
    assert.equal((page.html.match(/<link rel="stylesheet" href="\/style\.css">/g) ?? []).length, 1);
    assert.equal(page.html.includes("<style"), false);
    assert.equal(page.html.includes('style="'), false);
  }
});

test("renderHtml includes indexed section instance ids", () => {
  const html = renderHtml(modelWithPages()).pages[0].html;
  assert.match(html, new RegExp(`data-section-instance="${sectionInstanceId("hero", "split", 0)}"`));
  assert.match(html, new RegExp(`data-section-instance="${sectionInstanceId("hero", "centered", 1)}"`));
});

test("renderHtml throws for an unknown renderer", () => {
  const model = modelWithPages();
  model.pages[0].sections[0].variant = "nonexistent";
  assert.throws(() => renderHtml(model), /hero.*nonexistent/);
});

test("renderHtml rejects invalid models at the boundary", () => {
  assert.throws(() => renderHtml(null as never), (error: unknown) => error instanceof TypeError && /model/i.test(String(error)));
  assert.throws(() => renderHtml({} as never), (error: unknown) => error instanceof TypeError && /model/i.test(String(error)));
});

test("renderHtml is deterministic and escapes head content", () => {
  const model = modelWithPages();
  const first = renderHtml(model);
  const second = renderHtml(model);
  assert.deepEqual(first, second);
  assert.match(first.pages[0].html, /<title>home &lt;title&gt;<\/title>/);
  assert.match(first.pages[0].html, /content="home &amp; description"/);
});

test("renderHtml output has required document metadata", () => {
  const html = renderHtml(modelWithPages()).pages[0].html;
  assert.match(html, /^<!doctype html><html lang="en"><head>/);
  assert.match(html, /<meta charset="utf-8">/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
});

test("tokensToCss preserves the declared property order", () => {
  const css = tokensToCss(tokens);
  assert.ok(css.indexOf("--color-primary") < css.indexOf("--font-heading"));
  assert.ok(css.indexOf("--font-body") < css.indexOf("--container-max"));
});

test("renderHtml returns the shared stylesheet and theme data", () => {
  const result = renderHtml(modelWithPages());
  // Since #206 the stylesheet is a composition: tokens block, then the base
  // layer, then the css of the variants the site actually uses. The tokens
  // block is still the deterministic prefix.
  assert.ok(result.stylesheet.startsWith(tokensToCss(tokens)));
  assert.ok(result.stylesheet.includes("box-sizing: border-box"));
  assert.ok(result.stylesheet.includes(".hero-split__content"));
  assert.deepEqual(result.themeJson, themeJson(tokens));
});

function modelWithNav(): SiteModel {
  const model = modelWithPages();
  model.meta.businessName = 'A & B "<script>alert(1)</script>"';
  model.nav = [
    { label: "Home", href: "/" },
    { label: 'Tom & "Jerry"', href: "/about" },
    { label: "Evil", href: "javascript:alert(1)" },
  ];
  return model;
}

test("every page has exactly one header, main and footer landmark", () => {
  for (const page of renderHtml(modelWithPages()).pages) {
    assert.equal((page.html.match(/<header/g) ?? []).length, 1);
    assert.equal((page.html.match(/<main>/g) ?? []).length, 1);
    assert.equal((page.html.match(/<footer/g) ?? []).length, 1);
    assert.match(page.html, /<\/head><body><header[^>]*>.*<\/header><main>.*<\/main><footer[^>]*>.*<\/footer><\/body><\/html>$/);
  }
});

test("header links the escaped business name to / and footer repeats it", () => {
  const html = renderHtml(modelWithNav()).pages[0].html;
  assert.ok(html.includes('<a class="site-brand" href="/">A &amp; B &quot;&lt;script&gt;'));
  assert.ok(!html.includes("<script"));
  const footerStart = html.indexOf("<footer");
  assert.ok(html.slice(footerStart).includes("A &amp; B &quot;&lt;script&gt;"));
});

test("empty nav renders no nav element at all", () => {
  const html = renderHtml(modelWithPages()).pages[0].html;
  assert.ok(!html.includes("<nav"));
});

test("nav entries are escaped and unsafe hrefs neutralised", () => {
  const html = renderHtml(modelWithNav()).pages[0].html;
  const nav = html.slice(html.indexOf("<nav"), html.indexOf("</nav>"));
  assert.ok(nav.includes('href="/"'));
  assert.ok(nav.includes("Tom &amp; &quot;Jerry&quot;"));
  assert.ok(!nav.includes("javascript:"));
  assert.ok(nav.includes('href="#"'));
  assert.equal((nav.match(/<a /g) ?? []).length, 3);
});
