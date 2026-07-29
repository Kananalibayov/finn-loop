import assert from "node:assert/strict";
import { test } from "node:test";
import { getRenderer, listVariants, sectionInstanceId } from "./registry.ts";

test("registry returns both hero variants", () => {
  assert.equal(getRenderer("hero", "split")?.type, "hero");
  assert.equal(getRenderer("hero", "split")?.variant, "split");
  assert.equal(getRenderer("hero", "centered")?.type, "hero");
  assert.equal(getRenderer("hero", "centered")?.variant, "centered");
});

test("registry returns null for unknown variants and types", () => {
  assert.equal(getRenderer("hero", "nope"), null);
  assert.equal(getRenderer("faq", "split"), null);
});

test("section instance ids are versioned and indexed", () => {
  assert.equal(sectionInstanceId("hero", "split", 0), "hero-split-v1-0");
  assert.equal(sectionInstanceId("hero", "split", 2), "hero-split-v1-2");
  assert.throws(() => sectionInstanceId("hero", "split", -1), RangeError);
});

test("listVariants exposes only registered variants", () => {
  assert.deepEqual([...listVariants("hero")].sort(), ["centered", "split"]);
  assert.deepEqual(listVariants("faq"), []);
});
