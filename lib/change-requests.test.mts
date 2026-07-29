import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const dir = mkdtempSync(join(tmpdir(), "finn-loop-change-request-test-"));
process.env.DATABASE_FILE = join(dir, "test.db");

const { createChangeRequest, resolveChangeRequest } = await import("./db.ts");

test.after(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch (error) {
    // better-sqlite3 may keep the database file open on Windows.
    if ((error as NodeJS.ErrnoException).code !== "EPERM") throw error;
  }
});

function createPending() {
  return createChangeRequest({ clientId: 1, projectId: 1, instruction: "Update the heading" });
}

test("pending transitions to approved only from pending", () => {
  const request = createPending();
  const approved = resolveChangeRequest(request.id, "approved", "Looks good", ["pending"]);
  assert.equal(approved?.status, "approved");
  assert.equal(resolveChangeRequest(request.id, "approved", null, ["pending"]), null);
});

test("approved transitions to completed only from approved", () => {
  const request = createPending();
  assert.ok(resolveChangeRequest(request.id, "approved", null, ["pending"]));
  const completed = resolveChangeRequest(request.id, "completed", "Applied", ["approved"]);
  assert.equal(completed?.status, "completed");
});

test("approved can be rejected, but completed cannot", () => {
  const request = createPending();
  assert.ok(resolveChangeRequest(request.id, "approved", null, ["pending"]));
  assert.equal(resolveChangeRequest(request.id, "rejected", "Needs work", ["pending", "approved"])?.status, "rejected");
  assert.equal(resolveChangeRequest(request.id, "completed", null, ["approved"]), null);
});

test("unknown target or source statuses throw before SQL", () => {
  const request = createPending();
  assert.throws(
    () => resolveChangeRequest(request.id, "unknown", null, ["pending"]),
    /Unknown change-request status: unknown/,
  );
  assert.throws(
    () => resolveChangeRequest(request.id, "approved", null, ["unknown"]),
    /Unknown change-request status: unknown/,
  );
});
