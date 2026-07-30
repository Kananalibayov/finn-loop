import assert from "node:assert/strict";
import { test } from "node:test";
import { getRenderer, listVariants, sectionInstanceId } from "../registry.ts";
import type { DesignTokens, TestimonialsContent } from "../../site-model.ts";

const tokens: DesignTokens = {
  color: { primary: "#123456", accent: "#abcdef", bg: "#fff", surface: "#f5f5f5", text: "#111", muted: "#666", border: "#ddd" },
  font: { heading: "Inter", body: "Arial" }, typeScale: "1.25", spacingUnit: "0.5rem", radius: "0.25rem", shadow: "0 1px 2px #0003", containerMax: "70rem",
};
const context = { tokens, instanceId: "testimonials-cards-v1-0" };
const content: TestimonialsContent = { heading: "What clients say", items: [
  { quote: "Excellent work", author: "One", role: "Founder" },
  { quote: "Clear and helpful", author: "Two" },
  { quote: "Would recommend", author: "Three", role: "Director" },
] };

test("testimonial renderers are registered with exact variants", () => {
  for (const variant of ["cards", "single"] as const) {
    const renderer = getRenderer("testimonials", variant);
    assert.equal(renderer?.type, "testimonials");
    assert.equal(renderer?.variant, variant);
  }
  assert.deepEqual(listVariants("testimonials").sort(), ["cards", "single"]);
  assert.equal(getRenderer("testimonials", "nope"), null);
});

test("each testimonial variant renders its instance and all items", () => {
  for (const variant of ["cards", "single"] as const) {
    const html = getRenderer("testimonials", variant)!.html(content, { tokens, instanceId: sectionInstanceId("testimonials", variant, 0) });
    assert.equal((html.match(/data-section-instance=/g) ?? []).length, 1);
    assert.equal((html.match(/<blockquote>/g) ?? []).length, 3);
    assert.ok(html.includes("Excellent work") && html.includes("Founder"));
  }
});

test("testimonials escape untrusted quote text and derive colors from tokens", () => {
  const renderer = getRenderer("testimonials", "cards")!;
  const html = renderer.html({ items: [{ quote: 'Tom & "Jerry" <script>alert(1)</script>', author: "A" }] }, context);
  assert.ok(!html.includes("<script"));
  assert.ok(html.includes("&amp;") && html.includes("&lt;") && html.includes("&quot;"));
  const recolored = renderer.html({ items: [{ quote: "Plain", author: "A" }] }, { tokens: { ...tokens, color: { ...tokens.color, primary: "#fedcba" } }, instanceId: context.instanceId });
  assert.ok(recolored.includes("#fedcba"));
  assert.ok(!recolored.includes("#123456"));
});

test("testimonials omit optional roles and empty collections cleanly", () => {
  for (const variant of ["cards", "single"] as const) {
    const html = getRenderer("testimonials", variant)!.html({ items: [] }, context);
    assert.ok(!html.includes("<ul></ul>") && !html.includes("__item"));
    const optional = getRenderer("testimonials", variant)!.html({ items: [{ quote: "Only quote", author: "A" }] }, context);
    assert.ok(!optional.includes("<p></p>"));
  }
});

test("testimonials registration preserves hero variants", () => {
  assert.deepEqual(listVariants("hero").sort(), ["centered", "split"]);
});

test("cards and single remain distinct layouts", () => {
  const cards = getRenderer("testimonials", "cards")!.html(content, context);
  const single = getRenderer("testimonials", "single")!.html(content, context);
  assert.ok(cards.includes("testimonials-cards"));
  assert.ok(single.includes("testimonials-single"));
});

test("cards preserves its requested instance id", () => {
  const html = getRenderer("testimonials", "cards")!.html(content, { tokens, instanceId: sectionInstanceId("testimonials", "cards", 0) });
  assert.ok(html.includes('data-section-instance="testimonials-cards-v1-0"'));
});

test("single preserves its requested instance id", () => {
  const html = getRenderer("testimonials", "single")!.html(content, { tokens, instanceId: sectionInstanceId("testimonials", "single", 0) });
  assert.ok(html.includes('data-section-instance="testimonials-single-v1-0"'));
});

test("optional testimonials heading is omitted when absent", () => {
  const html = getRenderer("testimonials", "cards")!.html({ items: [{ quote: "Only", author: "A" }] }, context);
  assert.ok(!html.includes("<h2>"));
});

test("testimonials use semantic quote markup without executable output", () => {
  const html = getRenderer("testimonials", "single")!.html(content, context);
  assert.equal((html.match(/<cite>/g) ?? []).length, 3);
  assert.ok(!html.includes("<script") && !html.includes("onclick=") && !html.includes('style="'));
});
