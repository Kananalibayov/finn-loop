import assert from "node:assert/strict";
import { test } from "node:test";
import { getRenderer, listVariants, sectionInstanceId } from "../registry.ts";
import type { DesignTokens, StatsContent } from "../../site-model.ts";

const tokens: DesignTokens = {
  color: { primary: "#123456", accent: "#abcdef", bg: "#fff", surface: "#f5f5f5", text: "#111", muted: "#666", border: "#ddd" },
  font: { heading: "Inter", body: "Arial" }, typeScale: "1.25", spacingUnit: "0.5rem", radius: "0.25rem", shadow: "0 1px 2px #0003", containerMax: "70rem",
};
const context = { tokens, instanceId: "stats-grid-v1-0" };
const content: StatsContent = { heading: "By the numbers", items: [
  { value: "10k+", label: "Users" },
  { value: "99.9%", label: "Uptime" },
  { value: "24/7", label: "Support" },
] };

test("stats renderers are registered with exact variants (AC-1, AC-2, AC-3)", () => {
  for (const variant of ["row", "grid"] as const) {
    const renderer = getRenderer("stats", variant);
    assert.equal(renderer?.type, "stats");
    assert.equal(renderer?.variant, variant);
  }
  assert.deepEqual(listVariants("stats").sort(), ["grid", "row"]);
  assert.equal(getRenderer("stats", "nope"), null);
});

test("each stats variant renders its section instance exactly once (AC-4)", () => {
  for (const variant of ["row", "grid"] as const) {
    const html = getRenderer("stats", variant)!.html(content, { tokens, instanceId: sectionInstanceId("stats", variant, 0) });
    assert.equal((html.match(/data-section-instance=/g) ?? []).length, 1);
  }
});

test("row preserves its requested instance id (AC-4)", () => {
  const html = getRenderer("stats", "row")!.html(content, { tokens, instanceId: sectionInstanceId("stats", "row", 0) });
  assert.ok(html.includes('data-section-instance="stats-row-v1-0"'));
});

test("grid preserves its requested instance id (AC-4)", () => {
  const html = getRenderer("stats", "grid")!.html(content, { tokens, instanceId: sectionInstanceId("stats", "grid", 0) });
  assert.ok(html.includes('data-section-instance="stats-grid-v1-0"'));
});

test("stats escape untrusted label text (AC-5)", () => {
  const renderer = getRenderer("stats", "grid")!;
  const html = renderer.html({ items: [{ value: "1", label: 'Tom & "Jerry" <script>alert(1)</script>' }] }, context);
  assert.ok(!html.includes("<script"));
  assert.ok(html.includes("&amp;") && html.includes("&lt;") && html.includes("&quot;"));
});

test("stats derive color from tokens and never hardcode it (AC-6)", () => {
  const renderer = getRenderer("stats", "row")!;
  const html = renderer.html(content, { tokens: { ...tokens, color: { ...tokens.color, primary: "#123456" } }, instanceId: context.instanceId });
  assert.ok(html.includes("#123456"));
  const recolored = renderer.html(content, { tokens: { ...tokens, color: { ...tokens.color, primary: "#abcdef" } }, instanceId: context.instanceId });
  assert.ok(recolored.includes("#abcdef"));
  assert.ok(!recolored.includes("#123456"));
});

test("items empty renders a valid section with no orphaned dl (AC-8)", () => {
  for (const variant of ["row", "grid"] as const) {
    const html = getRenderer("stats", variant)!.html({ items: [] }, context);
    assert.ok(!html.includes("<dl></dl>"));
    assert.ok(html.startsWith("<section"));
  }
});

test("three items produce exactly three dt and three dd (AC-9)", () => {
  for (const variant of ["row", "grid"] as const) {
    const html = getRenderer("stats", variant)!.html(content, context);
    assert.equal((html.match(/<dt\b/g) ?? []).length, 3);
    assert.equal((html.match(/<dd\b/g) ?? []).length, 3);
  }
});

test("value is rendered verbatim, not parsed or reformatted (AC-10)", () => {
  for (const variant of ["row", "grid"] as const) {
    const html = getRenderer("stats", variant)!.html({ items: [{ value: "10k+", label: "Users" }, { value: "99.9%", label: "Uptime" }] }, context);
    assert.ok(html.includes("10k+"));
    assert.ok(html.includes("99.9%"));
  }
});

test("registering stats does not disturb hero variants (AC-11)", () => {
  assert.deepEqual(listVariants("hero").sort(), ["centered", "split"]);
});

test("row and grid remain distinct layouts", () => {
  const row = getRenderer("stats", "row")!.html(content, context);
  const grid = getRenderer("stats", "grid")!.html(content, context);
  assert.ok(row.includes("stats-row"));
  assert.ok(grid.includes("stats-grid"));
});

test("optional stats heading is omitted when absent", () => {
  const html = getRenderer("stats", "grid")!.html({ items: [{ value: "1", label: "One" }] }, context);
  assert.ok(!html.includes("<h2>"));
});

test("stats output contains no executable markup, inline styles, or JavaScript (Constraints 5, 8)", () => {
  for (const variant of ["row", "grid"] as const) {
    const html = getRenderer("stats", variant)!.html(content, context);
    assert.ok(!html.includes("<script"));
    assert.ok(!html.includes("onclick=") && !html.includes("onmouseover="));
    assert.ok(!html.includes('style="'));
    assert.ok(!html.includes("<style") && !html.includes("<link"));
  }
});
