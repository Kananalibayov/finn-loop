import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import type { BusinessInput } from "./types.ts";
import type { SitePlan } from "./plan.ts";

const input: BusinessInput = {
  businessName: "Riverside Plumbing",
  tagline: "Fast, reliable plumbing",
  description: "Licensed plumbers serving the riverside area with emergency callouts.",
  services: ["Emergency repair", "Water heaters"],
  phone: "555-0100",
  email: "hello@riverside.example",
  address: "1 Main St",
};

const plan: SitePlan = {
  version: 1,
  template: "custom",
  reasoning: "Hero plus services covers the brief.",
  pages: [
    { slug: "home", title: "Home", sections: [{ type: "hero", variant: "split" }] },
    { slug: "contact", title: "Contact", sections: [{ type: "hero", variant: "centered" }] },
  ],
};

/**
 * Mock the completions endpoint. `bodyFor` receives the parsed request so a test can return a
 * different payload per section type — write() issues one call per section, so a single canned
 * response cannot exercise the per-section paths.
 */
async function withMock(
  bodyFor: (req: Record<string, unknown>) => object,
  run: () => Promise<void>,
  opts: { finishReason?: string; raw?: string } = {},
): Promise<void> {
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(raw) as Record<string, unknown>;
      } catch (error) {
        // Surfaced rather than swallowed: if the SDK ever sends a non-JSON body, the
        // per-section assertions below would fail with a confusing empty `section` and no clue
        // why. This makes the real cause visible in the test output.
        console.error("[write.test] mock received a non-JSON request body:", (error as Error).message);
      }
      const content = opts.raw ?? JSON.stringify(bodyFor(parsed));
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        id: "mock",
        choices: [{ finish_reason: opts.finishReason ?? "stop", message: { role: "assistant", content } }],
      }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const oldKey = process.env.OPENAI_API_KEY;
  const oldBase = process.env.OPENAI_BASE_URL;
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${address.port}/v1`;
  try { await run(); } finally {
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
    if (oldBase === undefined) delete process.env.OPENAI_BASE_URL; else process.env.OPENAI_BASE_URL = oldBase;
    await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
  }
}

/** The section type being written, read off the json_schema name the request carries. */
function sectionOf(req: Record<string, unknown>): string {
  const rf = req.response_format as { json_schema?: { name?: string } } | undefined;
  return (rf?.json_schema?.name ?? "").replace(/_content$/, "");
}

const heroContent = { heading: "Plumbing fixed fast", subheading: "On call 24/7", cta: { label: "Get a quote", href: "/contact" } };

test("write produces a valid SiteModel from a plan", async () => {
  const { write } = await import("./write.ts");
  await withMock(() => heroContent, async () => {
    const model = await write(plan, input);
    const { isSiteModel } = await import("./site-model.ts");
    assert.ok(isSiteModel(model), "write() must produce a valid SiteModel");
    assert.equal(model.pages.length, 2);
    assert.deepEqual(model.pages.map((p) => p.slug), ["home", "contact"]);
    assert.equal(model.meta.businessName, "Riverside Plumbing");
  });
});

test("write output renders and passes the quality gates", async () => {
  const { write } = await import("./write.ts");
  await withMock(() => heroContent, async () => {
    const model = await write(plan, input);
    const { renderHtml } = await import("./render/render-html.ts");
    const { validateSite } = await import("./validate/validate.ts");
    const site = renderHtml(model);
    const report = validateSite(model, site);
    assert.equal(
      report.ok,
      true,
      `write() output must pass validateSite. Violations: ${JSON.stringify(report.violations)}`,
    );
  });
});

test("write asks for one schema-constrained call per section, and never for markup", async () => {
  const { write } = await import("./write.ts");
  const seen: Array<{ section: string; strict: unknown }> = [];
  await withMock((req) => {
    const rf = req.response_format as { json_schema?: { strict?: boolean } } | undefined;
    seen.push({ section: sectionOf(req), strict: rf?.json_schema?.strict });
    return heroContent;
  }, async () => {
    await write(plan, input);
  });
  assert.equal(seen.length, 2, "one call per section");
  assert.deepEqual(seen.map((s) => s.section), ["hero", "hero"]);
  assert.ok(seen.every((s) => s.strict === true), "every call must use strict json_schema");
});

test("write strips nulls so optional fields are absent, not null", async () => {
  const { write } = await import("./write.ts");
  // The schema requires every property, so a model returns null for an unused optional.
  await withMock(() => ({ heading: "Only a heading", subheading: null, cta: null }), async () => {
    const model = await write(plan, input);
    const content = model.pages[0].sections[0].content as Record<string, unknown>;
    assert.equal("subheading" in content, false, "null subheading must be stripped, not kept as null");
    assert.equal("cta" in content, false, "null cta must be stripped, not kept as null");
    assert.equal(content.heading, "Only a heading");
  });
});

test("write never invents images — gallery/logos get an empty images array", async () => {
  const { write } = await import("./write.ts");
  const galleryPlan: SitePlan = {
    ...plan,
    pages: [{ slug: "home", title: "Home", sections: [{ type: "hero", variant: "split" }, { type: "gallery", variant: "grid" }] }],
  };
  await withMock((req) => sectionOf(req) === "gallery" ? { heading: "Our work" } : heroContent, async () => {
    const model = await write(galleryPlan, input);
    const gallery = model.pages[0].sections[1].content as Record<string, unknown>;
    assert.deepEqual(gallery.images, [], "images must be an empty array the operator fills, never invented");
  });
});

test("write throws on a refusal or truncation rather than shipping a partial site", async () => {
  const { write } = await import("./write.ts");
  await withMock(() => heroContent, async () => {
    await assert.rejects(() => write(plan, input), /finish reason/i);
  }, { finishReason: "length" });
});

test("write throws on invalid JSON rather than silently dropping a section", async () => {
  const { write } = await import("./write.ts");
  await withMock(() => heroContent, async () => {
    await assert.rejects(() => write(plan, input), /invalid JSON/i);
  }, { raw: "{not json" });
});

test("write rejects a plan referencing an unregistered section before spending tokens", async () => {
  const { write } = await import("./write.ts");
  const badPlan = {
    ...plan,
    pages: [{ slug: "home", title: "Home", sections: [{ type: "hero", variant: "__never-registered__" }] }],
  } as unknown as SitePlan;
  let called = 0;
  await withMock(() => { called += 1; return heroContent; }, async () => {
    await assert.rejects(() => write(badPlan, input), /unregistered section/i);
  });
  assert.equal(called, 0, "must fail before issuing any completion request");
});

test("deriveTokens uses a stated brand colour and a safe default otherwise", async () => {
  const { deriveTokens } = await import("./write.ts");
  assert.equal(deriveTokens({ ...input, brandColors: "our blue is #AB12CD" }).color.primary, "#ab12cd");
  assert.equal(deriveTokens({ ...input, brandColors: "warm and friendly" }).color.primary, "#1d4ed8");
  assert.equal(deriveTokens(input).color.primary, "#1d4ed8");
});

test("write derives nav from the plan and seo per page", async () => {
  const { write } = await import("./write.ts");
  await withMock(() => heroContent, async () => {
    const model = await write(plan, input);
    assert.deepEqual(model.nav, [{ label: "Home", href: "/home" }, { label: "Contact", href: "/contact" }]);
    assert.equal(model.pages[0].seo.title, "Home — Riverside Plumbing");
    assert.ok(model.pages[0].seo.description.length > 0, "description must not be empty");
  });
});
