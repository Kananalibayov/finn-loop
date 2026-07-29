import assert from "node:assert/strict";
import { test } from "node:test";
import { heroCentered } from "./hero/centered.ts";
import { heroSplit } from "./hero/split.ts";
import { safeHref, type RenderContext } from "./types.ts";
import type { DesignTokens } from "../site-model.ts";

const allowed = [
  ["https://example.com/x?a=1", "https://example.com/x?a=1"],
  ["/pricing", "/pricing"],
  ["#faq", "#faq"],
  ["mailto:a@b.com", "mailto:a@b.com"],
  ["tel:+15551234", "tel:+15551234"],
] as const;

for (const [input, expected] of allowed) {
  test(`safeHref allows ${input}`, () => assert.equal(safeHref(input), expected));
}

const rejected = [
  "javascript:alert(1)",
  "JaVaScRiPt:alert(1)",
  " javascript:alert(1)",
  "java\tscript:alert(1)",
  "java\nscript:alert(1)",
  "\x01javascript:alert(1)",
  "data:text/html;base64,PHNjcmlwdD4=",
  "vbscript:msgbox",
  "file:///etc/passwd",
];

for (const input of rejected) {
  test(`safeHref rejects ${JSON.stringify(input)}`, () => assert.equal(safeHref(input), "#"));
}

test("safeHref rejects empty and whitespace-only values", () => {
  assert.equal(safeHref(""), "#");
  assert.equal(safeHref("   "), "#");
});

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

const context: RenderContext = { tokens, instanceId: "hero-v1-0" };

for (const [name, renderer] of [
  ["split", heroSplit],
  ["centered", heroCentered],
] as const) {
  test(`${name} renderer rejects javascript CTA URLs`, () => {
    const html = renderer.html(
      { heading: "Click", cta: { label: "Click", href: "javascript:alert(document.cookie)" } },
      context,
    );
    assert.ok(!/href="javascript:/i.test(html));
    assert.ok(html.includes('href="#"'));
  });

  test(`${name} renderer preserves an allowed CTA URL`, () => {
    const html = renderer.html(
      { heading: "Buy", cta: { label: "Buy", href: "https://x.test/buy" } },
      context,
    );
    assert.ok(html.includes('href="https://x.test/buy"'));
  });

  test(`${name} renderer escapes an allowed CTA URL`, () => {
    const html = renderer.html(
      { heading: "Buy", cta: { label: "Buy", href: "https://x.test/a?b=1&c=2" } },
      context,
    );
    assert.ok(html.includes('href="https://x.test/a?b=1&amp;c=2"'));
  });
}
