import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getRenderer, listVariants, sectionInstanceId } from "../registry.ts";
import type { DesignTokens, StepsContent } from "../../site-model.ts";

const tokens: DesignTokens = {
  color: { primary: "#123456", accent: "#abcdef", bg: "#fff", surface: "#f5f5f5", text: "#111", muted: "#666", border: "#ddd" },
  font: { heading: "Inter", body: "Arial" }, typeScale: "1.25", spacingUnit: "0.5rem", radius: "0.25rem", shadow: "0 1px 2px #0003", containerMax: "70rem",
};
const context = { tokens, instanceId: "steps-numbered-v1-0" };
const content: StepsContent = { heading: "How it works", items: [
  { title: "Pick a plan", description: "Choose what fits" },
  { title: "Onboard", description: "We set you up" },
  { title: "Ship" },
] };

test("steps renderers are registered with exact variants", () => {
  for (const variant of ["numbered", "timeline"] as const) {
    const renderer = getRenderer("steps", variant);
    assert.equal(renderer?.type, "steps");
    assert.equal(renderer?.variant, variant);
  }
  assert.deepEqual(listVariants("steps").sort(), ["numbered", "timeline"]);
  assert.equal(getRenderer("steps", "nope"), null);
});

test("each steps variant renders its section instance exactly once", () => {
  for (const variant of ["numbered", "timeline"] as const) {
    const renderer = getRenderer("steps", variant)!;
    const html = renderer.html(content, { tokens, instanceId: sectionInstanceId("steps", variant, 0) });
    assert.equal((html.match(/data-section-instance=/g) ?? []).length, 1);
    assert.ok(html.includes(`data-section-instance="${sectionInstanceId("steps", variant, 0)}"`));
  }
});

test("steps render all items inside a single <ol>", () => {
  for (const variant of ["numbered", "timeline"] as const) {
    const html = getRenderer("steps", variant)!.html(content, context);
    assert.ok(html.includes("<ol"));
    assert.ok(!html.includes("<ul"));
    assert.equal((html.match(/<li/g) ?? []).length, 3);
    assert.equal((html.match(/<\/ol>/g) ?? []).length, 1);
  }
});

test("steps escape untrusted text and derive colors from tokens", () => {
  const renderer = getRenderer("steps", "numbered")!;
  const html = renderer.html({ items: [{ title: 'Tom & "Jerry" <script>alert(1)</script>' }] }, context);
  assert.ok(!html.includes("<script"));
  assert.ok(html.includes("&amp;") && html.includes("&lt;") && html.includes("&quot;"));
  const recolored = renderer.html({ items: [{ title: "Plain" }] }, { tokens: { ...tokens, color: { ...tokens.color, primary: "#abcdef" } }, instanceId: context.instanceId });
  assert.ok(recolored.includes("#abcdef"));
  assert.ok(!recolored.includes("#123456"));
});

test("steps omit optional content and empty collections cleanly", () => {
  for (const variant of ["numbered", "timeline"] as const) {
    const empty = getRenderer("steps", variant)!.html({ items: [] }, context);
    assert.ok(!empty.includes("<ol></ol>") && !empty.includes("__item") && !empty.includes("__node"));
    const optional = getRenderer("steps", variant)!.html({ items: [{ title: "Only title" }] }, context);
    assert.ok(!optional.includes("<p></p>"));
  }
});

test("steps registration preserves hero and services variants", () => {
  assert.deepEqual(listVariants("hero").sort(), ["centered", "split"]);
  assert.deepEqual(listVariants("services").sort(), ["grid", "list"]);
});

test("numbered and timeline remain distinct layouts", () => {
  const numbered = getRenderer("steps", "numbered")!.html(content, context);
  const timeline = getRenderer("steps", "timeline")!.html(content, context);
  assert.ok(numbered.includes("steps-numbered"));
  assert.ok(timeline.includes("steps-timeline"));
  // timeline wraps its <ol> in a track container; numbered does not
  assert.ok(timeline.includes("steps-timeline__track"));
  assert.ok(!numbered.includes("__track"));
});

test("numbered preserves its requested instance id", () => {
  const html = getRenderer("steps", "numbered")!.html(content, { tokens, instanceId: sectionInstanceId("steps", "numbered", 0) });
  assert.ok(html.includes('data-section-instance="steps-numbered-v1-0"'));
});

test("timeline preserves its requested instance id", () => {
  const html = getRenderer("steps", "timeline")!.html(content, { tokens, instanceId: sectionInstanceId("steps", "timeline", 0) });
  assert.ok(html.includes('data-section-instance="steps-timeline-v1-0"'));
});

test("optional steps heading is omitted when absent", () => {
  const html = getRenderer("steps", "numbered")!.html({ items: [{ title: "Only" }] }, context);
  assert.ok(!html.includes("<h2>"));
});

test("steps never hand-write a leading numeral into the item text", () => {
  for (const variant of ["numbered", "timeline"] as const) {
    const html = getRenderer("steps", variant)!.html({ items: [{ title: "Pick a plan" }] }, context);
    assert.ok(!/>\s*1\.\s*Pick a plan/.test(html));
    assert.ok(!html.includes(">1."));
  }
});

test("steps output contains no executable markup or inline styles", () => {
  const html = getRenderer("steps", "timeline")!.html(content, context);
  assert.ok(!html.includes("<script") && !html.includes("onclick=") && !html.includes('style="'));
});

test("steps variant source files hardcode no colors (AC-7)", () => {
  // AC-7: variant files carry no literal hex colour; colours derive from ctx.tokens only.
  const hex = /#[0-9a-fA-F]{3,8}\b/;
  for (const file of ["numbered.ts", "timeline.ts"] as const) {
    const src = readFileSync(join(process.cwd(), "lib", "sections", "steps", file), "utf8");
    assert.ok(!hex.test(src), `${file} contains a literal hex colour`);
  }
});
