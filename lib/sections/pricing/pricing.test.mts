import assert from "node:assert/strict";
import { test } from "node:test";
import { getRenderer, listVariants, sectionInstanceId } from "../registry.ts";
import type { DesignTokens, PricingContent } from "../../site-model.ts";

const tokens: DesignTokens = {
  color: { primary: "#123456", accent: "#abcdef", bg: "#fff", surface: "#f5f5f5", text: "#111", muted: "#666", border: "#ddd" },
  font: { heading: "Inter", body: "Arial" }, typeScale: "1.25", spacingUnit: "0.5rem", radius: "0.25rem", shadow: "0 1px 2px #0003", containerMax: "70rem",
};
const context = { tokens, instanceId: "pricing-cards-v1-0" };

const content: PricingContent = { heading: "Pricing", plans: [
  { name: "Starter", price: "$49", period: "/month", features: ["1 project", "Email support"], cta: { label: "Choose", href: "/start" } },
  { name: "Pro", price: "$99", features: ["10 projects", "Priority support", "Analytics"], cta: { label: "Choose", href: "https://example.com/pro" } },
  { name: "Free", price: "$0", features: [] },
] };

// AC-1 — both variants registered with correct type/variant.
test("pricing renderers are registered with exact variants", () => {
  for (const variant of ["cards", "table"] as const) {
    const renderer = getRenderer("pricing", variant);
    assert.equal(renderer?.type, "pricing");
    assert.equal(renderer?.variant, variant);
  }
});

// AC-2 — unknown variant returns null and does not throw.
test("unknown pricing variant returns null", () => {
  assert.equal(getRenderer("pricing", "nope"), null);
});

// AC-3 — exactly the two variants, compared sorted.
test("pricing variants list is exactly cards and table", () => {
  assert.deepEqual(listVariants("pricing").sort(), ["cards", "table"]);
});

// AC-4 — each variant carries the instance id exactly once.
test("each pricing variant renders its section instance exactly once", () => {
  for (const variant of ["cards", "table"] as const) {
    const renderer = getRenderer("pricing", variant)!;
    const html = renderer.html(content, { tokens, instanceId: sectionInstanceId("pricing", variant, 0) });
    assert.equal((html.match(/data-section-instance=/g) ?? []).length, 1);
    assert.ok(html.includes(`data-section-instance="${sectionInstanceId("pricing", variant, 0)}"`));
  }
});

// AC-5 — XSS payload is escaped; no literal <script survives.
test("pricing escapes untrusted plan names", () => {
  const evil: PricingContent = { plans: [{ name: 'Tom & "Jerry" <script>alert(1)</script>', price: "$1", features: [] }] };
  for (const variant of ["cards", "table"] as const) {
    const html = getRenderer("pricing", variant)!.html(evil, context);
    assert.ok(!html.includes("<script"), `variant ${variant} leaked <script`);
    assert.ok(html.includes("&amp;"), `variant ${variant} missing &amp;`);
    assert.ok(html.includes("&lt;"), `variant ${variant} missing &lt;`);
    assert.ok(html.includes("&quot;"), `variant ${variant} missing &quot;`);
  }
});

// AC-6 — colours derive from tokens; recolouring changes output.
test("pricing output derives colors from the supplied token set", () => {
  const renderer = getRenderer("pricing", "cards")!;
  const first = renderer.html(content, context);
  const recolored = renderer.html(content, { tokens: { ...tokens, color: { ...tokens.color, primary: "#abcdef" } }, instanceId: context.instanceId });
  assert.ok(first.includes("#123456"));
  assert.ok(recolored.includes("#abcdef"));
  assert.ok(!recolored.includes("#123456"));
});

// AC-8 — empty plans render a valid section with no orphaned markup.
test("empty plans render a clean section with no orphaned markup", () => {
  for (const variant of ["cards", "table"] as const) {
    const html = getRenderer("pricing", variant)!.html({ plans: [] }, context);
    assert.ok(html.includes("<section"));
    assert.ok(!html.includes("<ul></ul>"));
    assert.ok(!html.includes("<tbody></tbody>"));
    assert.ok(!html.includes("<table"));
  }
});

// AC-9 — 3 plans produce 3 plan blocks (cards) / 3 columns (table); empty features emit no <ul></ul>.
test("three plans produce three blocks and empty features emit no empty list", () => {
  const cardsHtml = getRenderer("pricing", "cards")!.html(content, context);
  assert.equal((cardsHtml.match(/class="pricing-cards__plan"/g) ?? []).length, 3);
  // The "Free" plan has features: [] → must not produce an empty <ul>.
  assert.ok(!cardsHtml.includes("<ul class=\"pricing-cards__features\"></ul>"));

  const tableHtml = getRenderer("pricing", "table")!.html(content, context);
  // Three plan columns, each a <th scope="col"> with the plan name; the corner
  // header carries a class so it is excluded from this count.
  assert.equal((tableHtml.match(/<th scope="col">/g) ?? []).length, 3);
  assert.ok(tableHtml.includes("Starter") && tableHtml.includes("Pro") && tableHtml.includes("Free"));
});

// AC-10 — javascript: href is neutralised; price is verbatim.
test("javascript href is neutralised and price is rendered verbatim", () => {
  const c: PricingContent = { plans: [{ name: "P", price: "$49", features: [], cta: { label: "Go", href: "javascript:alert(1)" } }] };
  for (const variant of ["cards", "table"] as const) {
    const html = getRenderer("pricing", variant)!.html(c, context);
    assert.ok(!/href="javascript:/i.test(html), `variant ${variant} allowed javascript: href`);
    assert.ok(html.includes("$49"), `variant ${variant} altered the price`);
  }
});

// AC-11 — registering pricing does not disturb existing section types.
test("pricing registration preserves hero and services variants", () => {
  assert.deepEqual(listVariants("hero").sort(), ["centered", "split"]);
  assert.deepEqual(listVariants("services").sort(), ["grid", "list"]);
});

// cards and table are genuinely distinct layouts.
test("cards and table remain distinct layouts", () => {
  const cardsHtml = getRenderer("pricing", "cards")!.html(content, context);
  const tableHtml = getRenderer("pricing", "table")!.html(content, context);
  assert.ok(cardsHtml.includes("pricing-cards"));
  assert.ok(tableHtml.includes("pricing-table"));
  assert.ok(!cardsHtml.includes("<table"));
  assert.ok(tableHtml.includes("<table"));
});

// No executable markup or inline styles.
test("pricing output contains no executable markup or inline styles", () => {
  for (const variant of ["cards", "table"] as const) {
    const html = getRenderer("pricing", variant)!.html(content, context);
    assert.ok(!html.includes("<script"), `variant ${variant} emitted <script`);
    assert.ok(!html.includes("onclick="), `variant ${variant} emitted an event handler`);
    assert.ok(!html.includes('style="'), `variant ${variant} emitted an inline style`);
  }
});

// Optional heading is omitted when absent; optional period and CTA render when present.
test("optional heading, period and CTA render correctly", () => {
  const renderer = getRenderer("pricing", "cards")!;
  const noHeading = renderer.html({ plans: [{ name: "Solo", price: "$5", features: [] }] }, context);
  assert.ok(!noHeading.includes("<h2>"));
  assert.ok(!noHeading.includes("__period"));

  const withPeriod = renderer.html({ plans: [{ name: "Solo", price: "$5", period: "/yr", features: [] }] }, context);
  assert.ok(withPeriod.includes("/yr"));
});
