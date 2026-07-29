import assert from "node:assert/strict";
import { test } from "node:test";
import { UnsafeTargetError } from "./net.ts";
import { fetchHtml } from "./template-from-url.ts";

for (const [label, url] of [
  ["loopback", "http://127.0.0.1:9/"],
  ["localhost", "http://localhost/"],
  ["cloud metadata", "http://169.254.169.254/latest/meta-data"],
  ["unsupported scheme", "ftp://example.com/"],
] as const) {
  test(`fetchHtml rejects ${label} before network access`, async () => {
    await assert.rejects(fetchHtml(url), (error: unknown) => error instanceof UnsafeTargetError);
  });
}
