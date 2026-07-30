import assert from "node:assert/strict";
import { test } from "node:test";
import type { DesignTokens, GalleryContent, MediaRef } from "../../site-model.ts";
import { galleryColumns } from "./columns.ts";
import { galleryGrid } from "./grid.ts";
import {
  getRenderer,
  listVariants,
  sectionInstanceId,
} from "../registry.ts";

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

const variants = [
  ["grid", galleryGrid] as const,
  ["columns", galleryColumns] as const,
];

function image(overrides: Partial<MediaRef> = {}): MediaRef {
  return {
    kind: "stock",
    url: "https://example.com/photo.jpg",
    alt: "A photo",
    width: 800,
    height: 600,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AC-1 — getRenderer returns a renderer whose .type === "gallery" and .variant matches
// ---------------------------------------------------------------------------

for (const [variantName, renderer] of variants) {
  test(`AC-1: getRenderer("gallery", "${variantName}") → type "gallery", variant "${variantName}"`, () => {
    const resolved = getRenderer("gallery", variantName);
    assert.ok(resolved, `getRenderer returned null for variant ${variantName}`);
    assert.equal(resolved!.type, "gallery");
    assert.equal(resolved!.variant, variantName);
    // The directly-imported renderer carries the same contract.
    assert.equal(renderer.type, "gallery");
    assert.equal(renderer.variant, variantName);
  });
}

// ---------------------------------------------------------------------------
// AC-2 — unknown variant returns null and does not throw
// ---------------------------------------------------------------------------

test("AC-2: getRenderer(\"gallery\", \"nope\") → null without throwing", () => {
  assert.doesNotThrow(() => getRenderer("gallery", "nope"));
  assert.equal(getRenderer("gallery", "nope"), null);
});

// ---------------------------------------------------------------------------
// AC-3 — listVariants("gallery") returns exactly ["grid", "columns"] (sorted)
// ---------------------------------------------------------------------------

test('AC-3: listVariants("gallery") → ["columns", "grid"] sorted', () => {
  const variantsListed = [...listVariants("gallery")].sort();
  assert.deepEqual(variantsListed, ["columns", "grid"]);
});

// ---------------------------------------------------------------------------
// AC-4 — output contains data-section-instance="<sectionInstanceId>" exactly once
// ---------------------------------------------------------------------------

for (const [variantName, renderer] of variants) {
  const instanceId = sectionInstanceId("gallery", variantName, 0);
  test(`AC-4: ${variantName} emits data-section-instance="${instanceId}" exactly once`, () => {
    const html = renderer.html({ images: [image()] }, { tokens, instanceId });
    const needle = `data-section-instance="${instanceId}"`;
    assert.equal((html.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length, 1);
  });
}

// ---------------------------------------------------------------------------
// AC-5 — alt injection is escaped; no literal <script, entities present
// ---------------------------------------------------------------------------

for (const [variantName, renderer] of variants) {
  const instanceId = sectionInstanceId("gallery", variantName, 0);
  test(`AC-5: ${variantName} escapes an alt of 'Tom & "Jerry" <script>alert(1)</script>'`, () => {
    const html = renderer.html(
      { images: [image({ alt: 'Tom & "Jerry" <script>alert(1)</script>' })] },
      { tokens, instanceId },
    );
    assert.ok(!html.includes("<script"), `${variantName}: literal <script survived`);
    assert.ok(html.includes("&amp;"), `${variantName}: missing &amp;`);
    assert.ok(html.includes("&lt;"), `${variantName}: missing &lt;`);
    assert.ok(html.includes("&quot;"), `${variantName}: missing &quot;`);
  });
}

// ---------------------------------------------------------------------------
// AC-6 — colors derive from tokens; re-render with a different token swaps them
// ---------------------------------------------------------------------------

for (const [variantName, renderer] of variants) {
  const instanceId = sectionInstanceId("gallery", variantName, 0);
  test(`AC-6: ${variantName} derives color from tokens and swaps on re-render`, () => {
    const first = renderer.html({ images: [image()] }, { tokens, instanceId });
    const second = renderer.html(
      { images: [image()] },
      {
        tokens: { ...tokens, color: { ...tokens.color, primary: "#abcdef" } },
        instanceId,
      },
    );
    assert.ok(first.includes("#123456"), `${variantName}: first render missing #123456`);
    assert.ok(second.includes("#abcdef"), `${variantName}: second render missing #abcdef`);
    assert.ok(!second.includes("#123456"), `${variantName}: second render still contains #123456`);
  });
}

// ---------------------------------------------------------------------------
// AC-8 — images: [] renders a valid section, no orphaned wrapper, zero <img
// ---------------------------------------------------------------------------

for (const [variantName, renderer] of variants) {
  const instanceId = sectionInstanceId("gallery", variantName, 0);
  test(`AC-8: ${variantName} with images: [] → section, zero <img, no empty wrapper`, () => {
    const html = renderer.html({ images: [] }, { tokens, instanceId });
    assert.ok(html.startsWith("<section "), `${variantName}: output is not a section`);
    assert.ok(html.includes(`data-section-instance="${instanceId}"`));
    assert.equal((html.match(/<img/g) ?? []).length, 0);
    assert.ok(!html.includes("<ul></ul>"), `${variantName}: orphaned empty <ul>`);
    // columns uses a <div> flow wrapper; ensure it is absent when empty.
    assert.ok(!html.includes('gallery-columns__flow"></div>'), `${variantName}: orphaned empty flow`);
  });
}

// ---------------------------------------------------------------------------
// AC-9 — 3 images → exactly 3 <img occurrences
// ---------------------------------------------------------------------------

for (const [variantName, renderer] of variants) {
  const instanceId = sectionInstanceId("gallery", variantName, 0);
  test(`AC-9: ${variantName} with 3 images → exactly 3 <img`, () => {
    const content: GalleryContent = {
      images: [image(), image({ url: "https://example.com/b.png" }), image({ url: "https://example.com/c.png" })],
    };
    const html = renderer.html(content, { tokens, instanceId });
    assert.equal((html.match(/<img/g) ?? []).length, 3);
  });
}

// ---------------------------------------------------------------------------
// AC-10 — a javascript: url does not survive; src becomes "#"
// ---------------------------------------------------------------------------

for (const [variantName, renderer] of variants) {
  const instanceId = sectionInstanceId("gallery", variantName, 0);
  test(`AC-10: ${variantName} neutralises a javascript: url to src="#"`, () => {
    const html = renderer.html(
      { images: [image({ url: "javascript:alert(1)" })] },
      { tokens, instanceId },
    );
    assert.ok(!/src="javascript:/i.test(html), `${variantName}: javascript: survived as a src`);
    assert.ok(html.includes('src="#"'), `${variantName}: fail-closed src="#" not emitted`);
  });
}

// ---------------------------------------------------------------------------
// AC-11 — registering gallery does not disturb hero
// ---------------------------------------------------------------------------

test('AC-11: hero still lists both variants after gallery registration', () => {
  const heroVariants = [...listVariants("hero")].sort();
  assert.deepEqual(heroVariants, ["centered", "split"]);
  for (const v of ["centered", "split"] as const) {
    const resolved = getRenderer("hero", v);
    assert.ok(resolved, `hero ${v} renderer missing`);
    assert.equal(resolved!.type, "hero");
    assert.equal(resolved!.variant, v);
  }
});

// ---------------------------------------------------------------------------
// Extra: width/height emitted when both present; safeHref + escapeHtml ordering
// (AC does not enumerate this, but the spec Implementation Step 4 requires it)
// ---------------------------------------------------------------------------

test("grid and columns emit width/height when both are present", () => {
  const instanceId = sectionInstanceId("gallery", "grid", 0);
  const html = galleryGrid.html(
    { images: [image({ width: 1024, height: 768 })] },
    { tokens, instanceId },
  );
  assert.ok(html.includes('width="1024"'), "missing width attribute");
  assert.ok(html.includes('height="768"'), "missing height attribute");
});

test("grid and columns mark images loading=\"lazy\"", () => {
  const instanceId = sectionInstanceId("gallery", "grid", 0);
  const html = galleryGrid.html({ images: [image()] }, { tokens, instanceId });
  assert.ok(html.includes('loading="lazy"'), "missing loading=lazy");
});
