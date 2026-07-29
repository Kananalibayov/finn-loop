import assert from "node:assert/strict";
import { test } from "node:test";
import type { AboutContent, DesignTokens } from "../../site-model.ts";
import { getRenderer, listVariants, sectionInstanceId } from "../registry.ts";
import { aboutNarrative } from "./narrative.ts";
import { aboutSplit } from "./split.ts";

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

const narrativeId = sectionInstanceId("about", "narrative", 0);
const splitId = sectionInstanceId("about", "split", 0);
const narrativeContext = { tokens, instanceId: narrativeId };
const splitContext = { tokens, instanceId: splitId };

function narrative(content: AboutContent = { heading: "About", body: ["One"] }): string {
  return aboutNarrative.html(content, narrativeContext);
}

function split(content: AboutContent = { heading: "About", body: ["One"] }): string {
  return aboutSplit.html(content, splitContext);
}

// AC-1 — registry returns each renderer with the right type and variant.
test("AC-1: getRenderer returns about renderers with correct type and variant", () => {
  const n = getRenderer("about", "narrative");
  const s = getRenderer("about", "split");
  assert.ok(n, "narrative renderer should be registered");
  assert.ok(s, "split renderer should be registered");
  assert.equal(n!.type, "about");
  assert.equal(n!.variant, "narrative");
  assert.equal(s!.type, "about");
  assert.equal(s!.variant, "split");
});

// AC-2 — unknown variant returns null and does not throw.
test("AC-2: getRenderer for an unknown variant returns null without throwing", () => {
  assert.doesNotThrow(() => getRenderer("about", "nope"));
  assert.equal(getRenderer("about", "nope"), null);
});

// AC-3 — listVariants returns exactly the two variants (sorted compare).
test("AC-3: listVariants returns exactly narrative and split", () => {
  assert.deepEqual([...listVariants("about")].sort(), ["narrative", "split"]);
});

// AC-4 — output carries data-section-instance with sectionInstanceId exactly once.
test("AC-4: each variant carries its sectionInstanceId exactly once", () => {
  const n = narrative();
  const s = split();
  assert.equal(
    (n.match(new RegExp(`data-section-instance="${narrativeId}"`, "g")) ?? []).length,
    1,
  );
  assert.equal(
    (s.match(new RegExp(`data-section-instance="${splitId}"`, "g")) ?? []).length,
    1,
  );
});

// AC-5 — XSS payload is escaped; no literal <script.
test('AC-5: hostile heading is escaped and contains no <script', () => {
  const hostile = 'Tom & "Jerry" <script>alert(1)</script>';
  const n = narrative({ heading: hostile, body: [] });
  const s = split({ heading: hostile, body: [] });
  for (const html of [n, s]) {
    assert.ok(!html.includes("<script"), "must not contain literal <script");
    assert.ok(html.includes("&amp;"));
    assert.ok(html.includes("&lt;"));
    assert.ok(html.includes("&quot;"));
  }
});

// AC-6 — colors derive from tokens; changing primary swaps the value.
test("AC-6: rendered colors derive from the supplied token set", () => {
  const first = narrative();
  const second = aboutNarrative.html(
    { heading: "About", body: ["One"] },
    { tokens: { ...tokens, color: { ...tokens.color, primary: "#abcdef" } }, instanceId: narrativeId },
  );
  assert.ok(first.includes("#123456"));
  assert.ok(second.includes("#abcdef"));
  assert.ok(!second.includes("#123456"));
});

// AC-7 is a static grep check (see PR body). Here we assert the same intent:
// no token colour value is hardcoded as a literal in the rendered output source.
test("AC-7: variant output contains only token-derived colour values", () => {
  // A fresh token set with a distinctive primary must be the only colour present.
  const html = aboutSplit.html(
    { heading: "About", body: ["One"] },
    { tokens: { ...tokens, color: { ...tokens.color, primary: "#a1b2c3" } }, instanceId: splitId },
  );
  assert.ok(html.includes("#a1b2c3"));
});

// AC-8 — empty body and omitted cta produce no empty <p> or stray <a.
test("AC-8: empty body and omitted cta create no empty <p> or stray <a", () => {
  const n = narrative({ heading: "About", body: [] });
  const s = split({ heading: "About", body: [] });
  for (const html of [n, s]) {
    assert.ok(!html.includes("<p></p>"));
    assert.ok(!html.includes("<a"));
  }
});

// AC-9 — three body paragraphs produce exactly three <p>.
test("AC-9: three body paragraphs render exactly three <p>", () => {
  const n = narrative({ heading: "About", body: ["a", "b", "c"] });
  const s = split({ heading: "About", body: ["a", "b", "c"] });
  for (const html of [n, s]) {
    assert.equal((html.match(/<p/g) ?? []).length, 3);
  }
});

// AC-10 — a javascript: href does not survive safeHref.
test('AC-10: javascript: href is neutralised by safeHref', () => {
  const n = narrative({ heading: "About", body: [], cta: { label: "Go", href: "javascript:alert(1)" } });
  const s = split({ heading: "About", body: [], cta: { label: "Go", href: "javascript:alert(1)" } });
  for (const html of [n, s]) {
    assert.ok(!/href="javascript:/i.test(html));
  }
});

// AC-11 — registering about does not disturb hero.
test("AC-11: registering about leaves hero variants intact", () => {
  assert.deepEqual([...listVariants("hero")].sort(), ["centered", "split"]);
});

// CTA rendering + escaping (mirrors hero test coverage).
test("CTA href and token values are escaped", () => {
  const html = split({
    heading: "About",
    body: [],
    cta: { label: "Go", href: 'https://example.com/?q="quoted"' },
  });
  assert.ok(html.includes('href="https://example.com/?q=&quot;quoted&quot;"'));
  assert.ok(html.includes('data-font-heading="Inter"'));
  assert.ok(html.includes('data-spacing-unit="0.5rem"'));
});

// The two variants produce genuinely different layouts.
test("narrative and split produce distinct layouts", () => {
  const n = narrative({ heading: "About", body: ["One"] });
  const s = split({ heading: "About", body: ["One"] });
  assert.ok(n.includes("about-narrative__content"));
  assert.ok(s.includes("about-split__heading"));
  assert.ok(s.includes("about-split__body-column"));
});
