import assert from "node:assert/strict";
import { test } from "node:test";
import { getRenderer, listVariants, sectionInstanceId } from "../registry.ts";
import { logosStrip } from "./strip.ts";
import { logosGrid } from "./grid.ts";
import { heroSplit } from "../hero/split.ts";
import type { DesignTokens, LogosContent, MediaRef } from "../../site-model.ts";

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

function image(overrides: Partial<MediaRef> = {}): MediaRef {
  return {
    kind: "stock",
    url: "https://example.com/logo.png",
    alt: "Acme Co",
    width: 120,
    height: 40,
    ...overrides,
  };
}

function ctx(instanceId: string) {
  return { tokens, instanceId };
}

function content(overrides: Partial<LogosContent> = {}): LogosContent {
  return { images: [image()], ...overrides };
}

test("AC-1: getRenderer returns each logos variant with the right type and variant", () => {
  const strip = getRenderer("logos", "strip");
  const grid = getRenderer("logos", "grid");
  assert.equal(strip?.type, "logos");
  assert.equal(strip?.variant, "strip");
  assert.equal(grid?.type, "logos");
  assert.equal(grid?.variant, "grid");
});

test("AC-2: an unknown logos variant returns null without throwing", () => {
  assert.equal(getRenderer("logos", "nope"), null);
  assert.doesNotThrow(() => getRenderer("logos", "nope"));
});

test("AC-3: listVariants(logos) returns exactly strip and grid", () => {
  assert.deepEqual([...listVariants("logos")].sort(), ["grid", "strip"]);
});

test("AC-4: each variant carries its sectionInstanceId exactly once", () => {
  const stripId = sectionInstanceId("logos", "strip", 0);
  const gridId = sectionInstanceId("logos", "grid", 0);
  const stripHtml = logosStrip.html(content(), ctx(stripId));
  const gridHtml = logosGrid.html(content(), ctx(gridId));
  assert.equal(
    (stripHtml.match(new RegExp(`data-section-instance="${stripId}"`, "g")) ?? []).length,
    1,
  );
  assert.equal(
    (gridHtml.match(new RegExp(`data-section-instance="${gridId}"`, "g")) ?? []).length,
    1,
  );
});

test("AC-5: hostile alt text is escaped — no <script, entities present", () => {
  const hostile = content({
    images: [image({ alt: 'Tom & "Jerry" <script>alert(1)</script>' })],
  });
  for (const renderer of [logosStrip, logosGrid]) {
    const html = renderer.html(hostile, ctx(sectionInstanceId("logos", renderer.variant, 0)));
    assert.ok(!html.includes("<script"), `${renderer.variant} leaked <script`);
    assert.ok(html.includes("&amp;"), `${renderer.variant} missing &amp;`);
    assert.ok(html.includes("&lt;"), `${renderer.variant} missing &lt;`);
    assert.ok(html.includes("&quot;"), `${renderer.variant} missing &quot;`);
  }
});

test("AC-6: rendered colors derive from the supplied token set", () => {
  const first = logosStrip.html(content(), ctx(sectionInstanceId("logos", "strip", 0)));
  assert.ok(first.includes("#123456"));
  const second = logosStrip.html(content(), {
    tokens: { ...tokens, color: { ...tokens.color, primary: "#abcdef" } },
    instanceId: sectionInstanceId("logos", "strip", 1),
  });
  assert.ok(second.includes("#abcdef"));
  assert.ok(!second.includes("#123456"));
});

test("AC-8: empty images renders a valid section with zero <img and no orphan wrapper", () => {
  for (const renderer of [logosStrip, logosGrid]) {
    const html = renderer.html({ images: [] }, ctx(sectionInstanceId("logos", renderer.variant, 0)));
    assert.equal((html.match(/<img/g) ?? []).length, 0);
    assert.ok(!html.includes("<li></li>"));
    assert.ok(!html.includes("<ul></ul>"));
    // Still a well-formed section carrying its instance id.
    assert.ok(html.includes("<section"));
    assert.ok(html.includes('data-section-instance='));
  }
});

test("AC-9: four images produce exactly four <img", () => {
  const four = content({ images: [image(), image(), image(), image()] });
  for (const renderer of [logosStrip, logosGrid]) {
    const html = renderer.html(four, ctx(sectionInstanceId("logos", renderer.variant, 0)));
    assert.equal((html.match(/<img/g) ?? []).length, 4);
  }
});

test("AC-10: a javascript: url is neutralised to src=\"#\"", () => {
  const hostile = content({ images: [image({ url: "javascript:alert(1)" })] });
  for (const renderer of [logosStrip, logosGrid]) {
    const html = renderer.html(hostile, ctx(sectionInstanceId("logos", renderer.variant, 0)));
    assert.match(html, /src="#"/);
    assert.doesNotMatch(html, /src="javascript:/i);
  }
});

test("AC-11: registering logos does not disturb the hero variants", () => {
  const heroVariants = [...listVariants("hero")].sort();
  assert.deepEqual(heroVariants, ["centered", "split"]);
  // hero still renders and escapes.
  const html = heroSplit.html({ heading: 'Tom & "Jerry"' }, {
    tokens,
    instanceId: sectionInstanceId("hero", "split", 0),
  });
  assert.ok(html.includes("&amp;"));
});

test("rendered output includes width/height only when both are present", () => {
  const both = content({ images: [image({ width: 120, height: 40 })] });
  const htmlBoth = logosStrip.html(both, ctx(sectionInstanceId("logos", "strip", 0)));
  assert.ok(htmlBoth.includes('width="120"'));
  assert.ok(htmlBoth.includes('height="40"'));

  const neither = content({ images: [image({ width: 0 as number, height: 0 as number })] });
  const htmlNeither = logosStrip.html(neither, ctx(sectionInstanceId("logos", "strip", 1)));
  assert.ok(!htmlNeither.includes('width='));
  assert.ok(!htmlNeither.includes('height='));
});

test("optional heading renders only when present and is escaped", () => {
  const withHeading = content({ heading: 'Trusted & used by <b>many</b>' });
  const htmlH = logosGrid.html(withHeading, ctx(sectionInstanceId("logos", "grid", 0)));
  assert.ok(htmlH.includes("<h2>"));
  assert.ok(htmlH.includes("&amp;"));
  assert.ok(!htmlH.includes("<b>many</b>"));

  const noHeading = content();
  const htmlNo = logosGrid.html(noHeading, ctx(sectionInstanceId("logos", "grid", 1)));
  assert.ok(!htmlNo.includes("<h2"));
});
