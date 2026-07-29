import assert from "node:assert/strict";
import { test } from "node:test";
import { heroCentered } from "./centered.ts";
import { heroSplit } from "./split.ts";
import type { DesignTokens, HeroContent } from "../../site-model.ts";

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
  spacingUnit: "0.5rem",
  radius: "0.25rem",
  shadow: "0 1px 2px rgb(0 0 0 / 0.1)",
  containerMax: "70rem",
};

const context = { tokens, instanceId: "hero-split-v1-0" };

function render(renderer: typeof heroSplit, content: HeroContent = { heading: "Hello" }): string {
  return renderer.html(content, context);
}

test("split hero escapes content and renders a heading, subheading, and CTA", () => {
  const html = render(heroSplit, {
    heading: 'Tom & "Jerry" <script>alert(1)</script>',
    subheading: "A useful site",
    cta: { label: "Learn & grow", href: "/about?x=1&y=2" },
  });
  assert.equal((html.match(/<h1/g) ?? []).length, 1);
  assert.ok(!html.includes("<script"));
  assert.ok(html.includes("&amp;"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("&quot;Jerry&quot;"));
  assert.ok(html.includes("hero-split-v1-0"));
});

test("centered hero has a distinct layout and instance id", () => {
  const html = heroCentered.html({ heading: "Centered" }, {
    tokens,
    instanceId: "hero-centered-v1-0",
  });
  assert.ok(html.includes("hero-centered"));
  assert.ok(html.includes('data-section-instance="hero-centered-v1-0"'));
  assert.equal((html.match(/<h1/g) ?? []).length, 1);
});

test("hero output derives colors from the supplied token set", () => {
  const first = render(heroSplit);
  const second = heroSplit.html({ heading: "Hello" }, {
    tokens: { ...tokens, color: { ...tokens.color, primary: "#fedcba" } },
    instanceId: "hero-split-v1-1",
  });
  assert.ok(first.includes("#123456"));
  assert.ok(second.includes("#fedcba"));
  assert.ok(!second.includes("#123456"));
});

test("optional hero content does not create empty elements", () => {
  const html = render(heroSplit);
  assert.ok(!html.includes("<p></p>"));
  assert.ok(!html.includes("<a "));
});

test("CTA and token values are escaped", () => {
  const html = render(heroCentered, {
    heading: "Heading",
    cta: { label: "Go", href: 'https://example.com/?q="quoted"' },
  });
  assert.ok(html.includes('href="https://example.com/?q=&quot;quoted&quot;"'));
  assert.ok(html.includes("data-font-heading=\"Inter\""));
  assert.ok(html.includes("data-spacing-unit=\"0.5rem\""));
});
