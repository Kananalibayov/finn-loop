import assert from "node:assert/strict";
import { test } from "node:test";
import { getRenderer, listVariants, sectionInstanceId } from "../registry.ts";
import type { DesignTokens, FeaturesContent } from "../../site-model.ts";

const tokens: DesignTokens = {
  color: { primary: "#123456", accent: "#abcdef", bg: "#fff", surface: "#f5f5f5", text: "#111", muted: "#666", border: "#ddd" },
  font: { heading: "Inter", body: "Arial" }, typeScale: "1.25", spacingUnit: "0.5rem", radius: "0.25rem", shadow: "0 1px 2px #0003", containerMax: "70rem",
};
const context = { tokens, instanceId: "features-grid-v1-0" };
const content: FeaturesContent = { heading: "Why choose us", items: [
  { title: "One", description: "First feature" },
  { title: "Two", description: "Second feature" },
  { title: "Three" },
] };

test("features renderers are registered with exact variants", () => {
  for (const variant of ["grid", "alternating"] as const) {
    const renderer = getRenderer("features", variant);
    assert.equal(renderer?.type, "features");
    assert.equal(renderer?.variant, variant);
  }
  assert.deepEqual(listVariants("features").sort(), ["alternating", "grid"]);
  assert.equal(getRenderer("features", "nope"), null);
});

test("each features variant renders its instance and all items", () => {
  for (const variant of ["grid", "alternating"] as const) {
    const html = getRenderer("features", variant)!.html(content, { tokens, instanceId: sectionInstanceId("features", variant, 0) });
    assert.equal((html.match(/data-section-instance=/g) ?? []).length, 1);
    assert.equal((html.match(/class="features-[^"]*__item"/g) ?? []).length, 3);
    assert.ok(html.includes("One") && html.includes("Second feature"));
  }
});

test("features escape untrusted text and derive colors from tokens", () => {
  const renderer = getRenderer("features", "grid")!;
  const html = renderer.html({ items: [{ title: 'Tom & "Jerry" <script>alert(1)</script>' }] }, context);
  assert.ok(!html.includes("<script"));
  assert.ok(html.includes("&amp;") && html.includes("&lt;") && html.includes("&quot;"));
  const recolored = renderer.html({ items: [{ title: "Plain" }] }, { tokens: { ...tokens, color: { ...tokens.color, primary: "#fedcba" } }, instanceId: context.instanceId });
  assert.ok(recolored.includes("#fedcba"));
  assert.ok(!recolored.includes("#123456"));
});

test("features omit optional descriptions and empty collections cleanly", () => {
  for (const variant of ["grid", "alternating"] as const) {
    const html = getRenderer("features", variant)!.html({ items: [] }, context);
    assert.ok(!html.includes("<ul></ul>") && !html.includes("__item"));
    const optional = getRenderer("features", variant)!.html({ items: [{ title: "Only title" }] }, context);
    assert.ok(!optional.includes("<p></p>"));
  }
});

test("features registration preserves hero variants", () => {
  assert.deepEqual(listVariants("hero").sort(), ["centered", "split"]);
});

test("grid and alternating remain distinct layouts", () => {
  const grid = getRenderer("features", "grid")!.html(content, context);
  const alternating = getRenderer("features", "alternating")!.html(content, context);
  assert.ok(grid.includes("features-grid"));
  assert.ok(alternating.includes("features-alternating"));
});

test("grid preserves its requested instance id", () => {
  const html = getRenderer("features", "grid")!.html(content, { tokens, instanceId: sectionInstanceId("features", "grid", 0) });
  assert.ok(html.includes('data-section-instance="features-grid-v1-0"'));
});

test("alternating preserves its requested instance id", () => {
  const html = getRenderer("features", "alternating")!.html(content, { tokens, instanceId: sectionInstanceId("features", "alternating", 0) });
  assert.ok(html.includes('data-section-instance="features-alternating-v1-0"'));
});

test("optional features heading is omitted when absent", () => {
  const html = getRenderer("features", "grid")!.html({ items: [{ title: "Only" }] }, context);
  assert.ok(!html.includes("<h2>"));
});

test("features output contains no executable markup or inline styles", () => {
  const html = getRenderer("features", "alternating")!.html(content, context);
  assert.ok(!html.includes("<script") && !html.includes("onclick=") && !html.includes('style="'));
});
