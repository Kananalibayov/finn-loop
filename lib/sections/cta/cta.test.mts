import assert from "node:assert/strict";
import { test } from "node:test";
import { ctaBanner } from "./banner.ts";
import { ctaCentered } from "./centered.ts";
import { getRenderer, listVariants, sectionInstanceId } from "../registry.ts";
import type { CtaContent, DesignTokens } from "../../site-model.ts";

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

const baseContent: CtaContent = {
  heading: "Get started",
  cta: { label: "Sign up", href: "/signup" },
};

const variants = [
  { name: "banner" as const, renderer: ctaBanner },
  { name: "centered" as const, renderer: ctaCentered },
];

for (const { name, renderer } of variants) {
  // AC-1 — the registry returns the right renderer for each variant.
  test(`AC-1: getRenderer("cta", "${name}") returns a renderer of type cta / variant ${name}`, () => {
    const r = getRenderer("cta", name);
    assert.ok(r);
    assert.equal(r!.type, "cta");
    assert.equal(r!.variant, name);
    assert.equal(renderer.type, "cta");
    assert.equal(renderer.variant, name);
  });

  // AC-4 — data-section-instance is emitted exactly once per render.
  test(`AC-4: ${name} emits its section instance id exactly once`, () => {
    const id = sectionInstanceId("cta", name, 0);
    const html = renderer.html(baseContent, { tokens, instanceId: id });
    assert.equal((html.match(/data-section-instance=/g) ?? []).length, 1);
    assert.ok(html.includes(`data-section-instance="${id}"`));
  });

  // AC-5 — hostile content is escaped; no <script survives.
  test(`AC-5: ${name} escapes hostile heading and CTA label, no <script`, () => {
    const html = renderer.html(
      {
        heading: 'Tom & "Jerry" <script>alert(1)</script>',
        cta: { label: 'Go & "now" <script>alert(2)</script>', href: "/x" },
      },
      { tokens, instanceId: `cta-${name}-v1-0` },
    );
    assert.ok(!html.includes("<script"));
    assert.ok(html.includes("&amp;"));
    assert.ok(html.includes("&lt;script&gt;"));
    assert.ok(html.includes("&quot;Jerry&quot;"));
  });

  // AC-6 — token colours flow into the output.
  test(`AC-6: ${name} derives its colour from ctx.tokens`, () => {
    const first = renderer.html(baseContent, {
      tokens,
      instanceId: `cta-${name}-v1-0`,
    });
    assert.ok(first.includes("#123456"));
    const second = renderer.html(baseContent, {
      tokens: { ...tokens, color: { ...tokens.color, primary: "#abcdef" } },
      instanceId: `cta-${name}-v1-1`,
    });
    assert.ok(second.includes("#abcdef"));
    assert.ok(!second.includes("#123456"));
  });

  // AC-8 — omitting subheading emits no empty <p></p>.
  test(`AC-8: ${name} with no subheading emits no empty <p></p>`, () => {
    const html = renderer.html(baseContent, { tokens, instanceId: `cta-${name}-v1-0` });
    assert.ok(!html.includes("<p></p>"));
  });

  // AC-9 — the CTA anchor appears exactly once per render.
  test(`AC-9: ${name} renders the CTA anchor exactly once`, () => {
    const html = renderer.html(baseContent, { tokens, instanceId: `cta-${name}-v1-0` });
    assert.equal((html.match(/<a /g) ?? []).length, 1);
  });

  // AC-10 — a javascript: href is neutralised to "#".
  test(`AC-10: ${name} neutralises a javascript: href`, () => {
    const html = renderer.html(
      { heading: "H", cta: { label: "Go", href: "javascript:alert(1)" } },
      { tokens, instanceId: `cta-${name}-v1-0` },
    );
    assert.ok(!/href="javascript:/i.test(html));
    assert.ok(html.includes('href="#"'));
  });
}

// AC-2 — unknown variant returns null and does not throw.
test('AC-2: getRenderer("cta", "nope") returns null without throwing', () => {
  assert.equal(getRenderer("cta", "nope"), null);
});

// AC-3 — listVariants returns exactly the two registered variants.
test('AC-3: listVariants("cta") returns exactly ["banner","centered"] sorted', () => {
  assert.deepEqual([...listVariants("cta")].sort(), ["banner", "centered"]);
});

// AC-11 — registering cta did not disturb hero's variants.
test('AC-11: hero variants are unaffected by registering cta', () => {
  assert.deepEqual([...listVariants("hero")].sort(), ["centered", "split"]);
});
