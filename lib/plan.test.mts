import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import type { BusinessInput } from "./types.ts";

const input: BusinessInput = {
  businessName: "Example", tagline: "A clear promise", description: "A useful service",
  services: ["Design"], phone: "555-0100", email: "hello@example.com", address: "1 Main St",
};

const validPlan = {
  version: 1, template: "custom", reasoning: "A focused hero serves the brief.",
  pages: [{ slug: "home", title: "Home", sections: [{ type: "hero", variant: "split" }] }],
};

async function withMock(response: object, run: () => Promise<void>): Promise<void> {
  const server = createServer((_req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ id: "mock", choices: [{ finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(response) } }] }));
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
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("plan accepts a valid mocked site plan", async () => {
  const { plan } = await import("./plan.ts");
  await withMock(validPlan, async () => assert.deepEqual(await plan(input), validPlan));
});

test("plan rejects an unregistered section variant", async () => {
  const { plan } = await import("./plan.ts");
  // "nope" is a never-registered variant: this premise survives future section registrations (#204).
  await withMock({ ...validPlan, pages: [{ ...validPlan.pages[0], sections: [{ type: "services", variant: "nope" }] }] },
    async () => await assert.rejects(() => plan(input), /invalid|unrenderable/i));
});

test("plan rejects a truncated completion", async () => {
  const server = createServer((_req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ id: "mock", choices: [{ finish_reason: "length", message: { role: "assistant", content: "" } }] }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const oldKey = process.env.OPENAI_API_KEY;
  const oldBase = process.env.OPENAI_BASE_URL;
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${address.port}/v1`;
  try {
    const { plan } = await import("./plan.ts");
    await assert.rejects(() => plan(input), /finish reason: length/);
  } finally {
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
    if (oldBase === undefined) delete process.env.OPENAI_BASE_URL; else process.env.OPENAI_BASE_URL = oldBase;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
