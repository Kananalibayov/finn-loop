import assert from "node:assert/strict";
import { test } from "node:test";
import { getRenderer, listVariants, sectionInstanceId } from "../registry.ts";
import type { DesignTokens, FaqContent } from "../../site-model.ts";

const tokens: DesignTokens = {
  color: { primary: "#123456", accent: "#abcdef", bg: "#fff", surface: "#f5f5f5", text: "#111", muted: "#666", border: "#ddd" },
  font: { heading: "Inter", body: "Arial" }, typeScale: "1.25", spacingUnit: "0.5rem", radius: "0.25rem", shadow: "0 1px 2px #0003", containerMax: "70rem",
};
const context = { tokens, instanceId: "faq-accordion-v1-0" };
const content: FaqContent = { heading: "Common questions", items: [
  { question: "How much?", answer: "Fixed quote up front." },
  { question: "How long?", answer: "Two weeks." },
  { question: "Warranty?", answer: "One year." },
] };

test("faq renderers are registered with exact variants (AC-1, AC-2, AC-3)", () => {
  for (const variant of ["accordion", "list"] as const) {
    const renderer = getRenderer("faq", variant);
    assert.equal(renderer?.type, "faq");
    assert.equal(renderer?.variant, variant);
  }
  assert.equal(getRenderer("faq", "nope"), null);
  assert.deepEqual(listVariants("faq").sort(), ["accordion", "list"]);
});

test("each faq variant renders its instance id exactly once (AC-4)", () => {
  for (const variant of ["accordion", "list"] as const) {
    const id = sectionInstanceId("faq", variant, 0);
    const html = getRenderer("faq", variant)!.html(content, { tokens, instanceId: id });
    assert.equal(html.split(`data-section-instance="${id}"`).length - 1, 1);
  }
});

test("faq escapes untrusted question text (AC-5)", () => {
  for (const variant of ["accordion", "list"] as const) {
    const html = getRenderer("faq", variant)!.html(
      { items: [{ question: 'Tom & "Jerry" <script>alert(1)</script>', answer: "A" }] },
      { tokens, instanceId: sectionInstanceId("faq", variant, 0) },
    );
    assert.ok(!html.includes("<script"));
    assert.ok(html.includes("&amp;") && html.includes("&lt;") && html.includes("&quot;"));
  }
});

test("faq derives colors from tokens (AC-6)", () => {
  const renderer = getRenderer("faq", "accordion")!;
  const first = renderer.html(content, context);
  assert.ok(first.includes("#123456"));
  const recolored = renderer.html(content, { tokens: { ...tokens, color: { ...tokens.color, primary: "#abcdef" } }, instanceId: context.instanceId });
  assert.ok(recolored.includes("#abcdef"));
  assert.ok(!recolored.includes("#123456"));
});

test("empty items render no orphaned markup (AC-8)", () => {
  for (const variant of ["accordion", "list"] as const) {
    const html = getRenderer("faq", variant)!.html({ items: [] }, context);
    assert.ok(html.includes("<section"));
    assert.ok(!html.includes("<ul></ul>"));
    assert.ok(!html.includes("__item"));
    assert.ok(!html.includes("<details"));
  }
});

test("three items produce three item blocks (AC-9)", () => {
  const accordion = getRenderer("faq", "accordion")!.html(content, context);
  assert.equal((accordion.match(/<details/g) ?? []).length, 3);
  assert.equal((accordion.match(/<summary/g) ?? []).length, 3);
  const list = getRenderer("faq", "list")!.html(content, context);
  assert.equal((list.match(/<li /g) ?? []).length, 3);
});

test("accordion uses native details/summary, list expands every item (layout distinction)", () => {
  const accordion = getRenderer("faq", "accordion")!.html(content, context);
  assert.ok(accordion.includes("<details") && accordion.includes("<summary"));
  const list = getRenderer("faq", "list")!.html(content, context);
  assert.ok(!list.includes("<details"));
  assert.ok(list.includes("<ul") && list.includes("<h3>"));
});

test("registering faq does not disturb hero (AC-10)", () => {
  assert.deepEqual(listVariants("hero").sort(), ["centered", "split"]);
});

test("optional heading is omitted when absent", () => {
  const html = getRenderer("faq", "list")!.html({ items: content.items }, context);
  assert.ok(!html.includes("<h2>"));
  const withHeading = getRenderer("faq", "list")!.html(content, context);
  assert.ok(withHeading.includes("<h2>Common questions</h2>"));
});

test("faq escapes untrusted answer text", () => {
  for (const variant of ["accordion", "list"] as const) {
    const html = getRenderer("faq", variant)!.html(
      { items: [{ question: "Q", answer: 'A & "B" <script>alert(1)</script>' }] },
      { tokens, instanceId: sectionInstanceId("faq", variant, 0) },
    );
    assert.ok(!html.includes("<script"));
    assert.ok(html.includes("&amp;") && html.includes("&lt;") && html.includes("&quot;"));
  }
});
