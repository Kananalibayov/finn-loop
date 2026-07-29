// Covers lib/db.ts verifyHealthSecret (issue #97). health-report is a public,
// unauthenticated endpoint — this is its only auth check, so a wrong-length
// comparison that throws, or a length-leaking pre-check, is a real defect.
//
// Run: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "finn-loop-db-test-"));
process.env.DATABASE_FILE = join(dir, "test.db");

const { addWpConnection, deleteWpConnection, verifyHealthSecret } = await import("./db.ts");

test.after(() => {
  // better-sqlite3 keeps its file handle open for the life of the process (lib/db.ts
  // has no exported close()), so on Windows the temp dir can still be locked here.
  // Best-effort cleanup only — leftover temp files are not a test-correctness concern.
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

test("verifyHealthSecret: correct secret returns true", () => {
  const conn = addWpConnection({
    label: "t",
    apiUrl: "https://example.com",
    username: "u",
    appPassword: "p",
    healthSecret: "a".repeat(64),
  });
  assert.equal(verifyHealthSecret(conn.id, "a".repeat(64)), true);
  deleteWpConnection(conn.id);
});

test("verifyHealthSecret: wrong secret, same length, returns false", () => {
  const conn = addWpConnection({
    label: "t",
    apiUrl: "https://example.com",
    username: "u",
    appPassword: "p",
    healthSecret: "a".repeat(64),
  });
  assert.equal(verifyHealthSecret(conn.id, "b".repeat(64)), false);
  deleteWpConnection(conn.id);
});

test("verifyHealthSecret: wrong secret, different length, returns false and does not throw", () => {
  const conn = addWpConnection({
    label: "t",
    apiUrl: "https://example.com",
    username: "u",
    appPassword: "p",
    healthSecret: "a".repeat(64),
  });
  assert.doesNotThrow(() => {
    assert.equal(verifyHealthSecret(conn.id, "short"), false);
  });
  deleteWpConnection(conn.id);
});

test("verifyHealthSecret: connection with NULL health_secret returns false", () => {
  const conn = addWpConnection({
    label: "t",
    apiUrl: "https://example.com",
    username: "u",
    appPassword: "p",
  });
  assert.equal(verifyHealthSecret(conn.id, "anything"), false);
  deleteWpConnection(conn.id);
});
