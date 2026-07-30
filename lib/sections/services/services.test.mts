import assert from "node:assert/strict";
import { test } from "node:test";
import { getRenderer, listVariants, sectionInstanceId } from "../registry.ts";
import type { DesignTokens, ServicesContent } from "../../site-model.ts";

const tokens: DesignTokens = {
  color: { primary: "#123456", accent: "#abcdef", bg: "#fff", surface: "#f5f5f5", text: "#111", muted: "#666", border: "#ddd" },
  font: { heading: "Inter", body: "Arial" }, typeScale: "1.25", spacingUnit: "0.5rem", radius: "0.25rem", shadow: "0 1px 2px #0003", containerMax: "70rem",
};
const context = { tokens, instanceId: "services-grid-v1-0" };
const content: ServicesContent = { heading: "What we do", items: [
  { title: "One", description: "First service", price: "$10" },
  { title: "Two", description: "Second service" },
  { title: "Three", price: "$30" },
] };

test("services renderers are registered with exact variants", () => {
  for (const variant of ["grid", "list"] as const) {
    const renderer = getRenderer("services", variant);
    assert.equal(renderer?.type, "services");
    assert.equal(renderer?.variant, variant);
  }
  assert.deepEqual(listVariants("services").sort(), ["grid", "list"]);
  assert.equal(getRenderer("services", "nope"), null);
});

test("each services variant renders its section instance and all items", () => {
  for (const variant of ["grid", "list"] as const) {
    const renderer = getRenderer("services", variant)!;
    const html = renderer.html(content, { tokens, instanceId: sectionInstanceId("services", variant, 0) });
    assert.equal((html.match(/data-section-instance=/g) ?? []).length, 1);
    assert.equal((html.match(/class="services-[^"]*__item"/g) ?? []).length, 3);
    assert.ok(html.includes("One") && html.includes("$10") && html.includes("Second service"));
  }
});

test("services escape untrusted text and derive colors from tokens", () => {
  const renderer = getRenderer("services", "grid")!;
  const html = renderer.html({ items: [{ title: 'Tom & "Jerry" <script>alert(1)</script>' }] }, context);
  assert.ok(!html.includes("<script"));
  assert.ok(html.includes("&amp;") && html.includes("&lt;") && html.includes("&quot;"));
  const recolored = renderer.html({ items: [{ title: "Plain" }] }, { tokens: { ...tokens, color: { ...tokens.color, primary: "#fedcba" } }, instanceId: context.instanceId });
  assert.ok(recolored.includes("#fedcba"));
  assert.ok(!recolored.includes("#123456"));
});

test("services omit optional content and empty collections cleanly", () => {
  for (const variant of ["grid", "list"] as const) {
    const html = getRenderer("services", variant)!.html({ items: [] }, context);
    assert.ok(!html.includes("<ul></ul>") && !html.includes("__item"));
    const optional = getRenderer("services", variant)!.html({ items: [{ title: "Only title" }] }, context);
    assert.ok(!optional.includes("<p></p>") && !optional.includes("__price"));
  }
});

test("services registration preserves hero variants", () => {
  assert.deepEqual(listVariants("hero").sort(), ["centered", "split"]);
});

test("grid and list remain distinct layouts", () => {
  const grid = getRenderer("services", "grid")!.html(content, context);
  const list = getRenderer("services", "list")!.html(content, context);
  assert.ok(grid.includes("services-grid"));
  assert.ok(list.includes("services-list"));
});

test("grid preserves its requested instance id", () => {
  const html = getRenderer("services", "grid")!.html(content, { tokens, instanceId: sectionInstanceId("services", "grid", 0) });
  assert.ok(html.includes('data-section-instance="services-grid-v1-0"'));
});

test("list preserves its requested instance id", () => {
  const html = getRenderer("services", "list")!.html(content, { tokens, instanceId: sectionInstanceId("services", "list", 0) });
  assert.ok(html.includes('data-section-instance="services-list-v1-0"'));
});

test("optional services heading is omitted when absent", () => {
  const html = getRenderer("services", "grid")!.html({ items: [{ title: "Only" }] }, context);
  assert.ok(!html.includes("<h2>"));
});

test("services output contains no executable markup or inline styles", () => {
  const html = getRenderer("services", "list")!.html(content, context);
  assert.ok(!html.includes("<script") && !html.includes("onclick=") && !html.includes('style="'));
});
