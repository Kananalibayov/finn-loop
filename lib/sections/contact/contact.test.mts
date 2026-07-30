import assert from "node:assert/strict";
import { test } from "node:test";
import { getRenderer, listVariants } from "../registry.ts";
import { contactStacked } from "./stacked.ts";
import { contactSplit } from "./split.ts";
import type { ContactContent, DesignTokens } from "../../site-model.ts";

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
  { name: "stacked", renderer: contactStacked },
  { name: "split", renderer: contactSplit },
] as const;

// AC-1: renderer metadata
test("contact renderers report the contact type and their own variant", () => {
  assert.equal(contactStacked.type, "contact");
  assert.equal(contactStacked.variant, "stacked");
  assert.equal(contactSplit.type, "contact");
  assert.equal(contactSplit.variant, "split");
});

// AC-1, AC-2, AC-3: registry lookups for contact
test("registry resolves both contact variants and nulls the unknown one", () => {
  assert.equal(getRenderer("contact", "stacked")?.type, "contact");
  assert.equal(getRenderer("contact", "stacked")?.variant, "stacked");
  assert.equal(getRenderer("contact", "split")?.type, "contact");
  assert.equal(getRenderer("contact", "split")?.variant, "split");
  assert.equal(getRenderer("contact", "nope"), null);
  assert.deepEqual([...listVariants("contact")].sort(), ["split", "stacked"]);
});

// AC-5: content is escaped; no raw <script>
test("contact variants escape interpolated content", () => {
  const content: ContactContent = {
    heading: 'Tom & "Jerry" <script>alert(1)</script>',
    body: ["Line <b>one</b>", "Line & two"],
    showForm: false,
  };
  for (const { renderer } of variants) {
    const html = renderer.html(content, { tokens, instanceId: "contact-x-v1-0" });
    assert.ok(!html.includes("<script"), `${renderer.variant}: raw <script leaked`);
    assert.ok(html.includes("&amp;"), `${renderer.variant}: missing &amp;`);
    assert.ok(html.includes("&lt;"), `${renderer.variant}: missing &lt;`);
    assert.ok(html.includes("&quot;"), `${renderer.variant}: missing &quot;`);
  }
});

// AC-6: colours derive from the supplied token set
test("contact output derives colours from the supplied token set", () => {
  const content: ContactContent = { heading: "Hello", showForm: true };
  for (const { renderer } of variants) {
    const first = renderer.html(content, { tokens, instanceId: "contact-a-v1-0" });
    const second = renderer.html(content, {
      tokens: { ...tokens, color: { ...tokens.color, primary: "#abcdef" } },
      instanceId: "contact-a-v1-1",
    });
    assert.ok(first.includes("#123456"), `${renderer.variant}: first render missing #123456`);
    assert.ok(second.includes("#abcdef"), `${renderer.variant}: second render missing #abcdef`);
    assert.ok(!second.includes("#123456"), `${renderer.variant}: stale #123456 leaked`);
  }
});

// AC-4: data-section-instance appears exactly once per variant
test("contact variants emit data-section-instance exactly once", () => {
  const content: ContactContent = { heading: "Hello", showForm: false };
  for (const { name, renderer } of variants) {
    const instanceId = `contact-${name}-v1-0`;
    const html = renderer.html(content, { tokens, instanceId });
    assert.equal(
      (html.match(/data-section-instance="contact-/g) ?? []).length,
      1,
      `${name}: expected exactly one contact data-section-instance`,
    );
    assert.ok(html.includes(`data-section-instance="${instanceId}"`));
  }
});

// AC-8: showForm false, no body → valid section, no form, no empty <p></p>
test("contact without a form renders text only and no empty paragraphs", () => {
  const content: ContactContent = { heading: "Reach us", showForm: false };
  for (const { renderer } of variants) {
    const html = renderer.html(content, { tokens, instanceId: "contact-novari-v1-0" });
    assert.ok(html.includes("<section"), `${renderer.variant}: missing section`);
    assert.ok(!html.includes("<form"), `${renderer.variant}: unexpected form`);
    assert.ok(!html.includes("<p></p>"), `${renderer.variant}: empty paragraph leaked`);
  }
});

// AC-9: showForm true → exactly one form, three labels, one submit; label/ids match
test("contact form has three labelled fields and a submit, with matching for/id pairs", () => {
  const content: ContactContent = { heading: "Reach us", showForm: true };
  for (const { name, renderer } of variants) {
    const instanceId = `contact-${name}-v1-0`;
    const html = renderer.html(content, { tokens, instanceId });
    assert.equal((html.match(/<form/g) ?? []).length, 1, `${name}: expected one form`);
    assert.equal((html.match(/<label/g) ?? []).length, 3, `${name}: expected three labels`);
    assert.equal(
      (html.match(/<button type="submit"/g) ?? []).length,
      1,
      `${name}: expected one submit button`,
    );
    // Every for= must point at an id= present in the same output.
    const fors = [...html.matchAll(/for="([^"]+)"/g)].map((m) => m[1]);
    const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
    for (const f of fors) {
      assert.ok(ids.has(f), `${name}: label for="${f}" has no matching id`);
    }
  }
});

// AC-9 continued: two instances on one page must not collide ids
test("two contact instances on one page do not collide field ids", () => {
  const content: ContactContent = { heading: "Reach us", showForm: true };
  for (const { renderer } of variants) {
    const a = renderer.html(content, { tokens, instanceId: "contact-dup-v1-0" });
    const b = renderer.html(content, { tokens, instanceId: "contact-dup-v1-1" });
    const idsA = [...a.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    const idsB = [...b.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    const intersection = idsA.filter((id) => idsB.includes(id));
    assert.deepEqual(intersection, [], `${renderer.variant}: ids collided across instances`);
  }
});

// No form attributes that would fabricate an endpoint (constraint 9)
test("contact form carries no action, method, or inline script handler", () => {
  const content: ContactContent = { heading: "Reach us", showForm: true };
  for (const { renderer } of variants) {
    const html = renderer.html(content, { tokens, instanceId: "contact-attr-v1-0" });
    assert.ok(!/action=/.test(html), `${renderer.variant}: unexpected action attribute`);
    assert.ok(!/method=/.test(html), `${renderer.variant}: unexpected method attribute`);
    assert.ok(!/<script/i.test(html), `${renderer.variant}: unexpected <script>`);
    assert.ok(!/on\w+=/i.test(html), `${renderer.variant}: unexpected inline event handler`);
  }
});

// AC-7 regression guard: no literal hex colour in the variant source
test("contact variant source files contain no literal hex colour", async () => {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  for (const file of ["stacked.ts", "split.ts"]) {
    const src = await readFile(join(import.meta.dirname, file), "utf8");
    const matches = src.match(/#[0-9a-fA-F]{3,8}\b/g);
    assert.equal(matches, null, `${file}: literal hex colour found -> ${matches?.join(", ")}`);
  }
});
