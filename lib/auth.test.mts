// Covers lib/auth.ts requireRole — the shared in-handler role gate added in
// issue #100 (GAP-LEDGER §8.1). Security-critical: a single wrong branch here
// hands a read-only viewer WordPress administrator on every client site.
//
// Run: node --test "lib/**/*.test.mts"  (npm test once PR #99 merges)
//
// Mints real HS256 JWTs with jose against a test-only session secret and
// asserts the gate's accept/reject decision for every session shape that
// exists in production: legacy admin, operator admin/editor/viewer, client,
// unknown operator role, garbage and missing tokens.

process.env.ADMIN_SESSION_SECRET =
  "test-only-session-secret-not-a-real-credential-0123456789abcdef";

import { test } from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";
import {
  hashPassword,
  legacyAdminCandidateHashes,
  requireRole,
  verifyPasswordAgainstHash,
} from "./auth.ts";

const secret = new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET);

function mint(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("300s")
    .sign(secret);
}

test("operator admin passes the admin gate", async () => {
  const token = await mint({ role: "operator", operatorId: 7, operatorRole: "admin" });
  const session = await requireRole(token, "admin");
  assert.ok(session, "expected a session");
  assert.equal(session.operatorId, 7);
  assert.equal(session.operatorRole, "admin");
});

test("operator editor fails the admin gate", async () => {
  const token = await mint({ role: "operator", operatorId: 8, operatorRole: "editor" });
  assert.equal(await requireRole(token, "admin"), null);
});

test("operator editor passes the editor gate", async () => {
  const token = await mint({ role: "operator", operatorId: 8, operatorRole: "editor" });
  const session = await requireRole(token, "editor");
  assert.ok(session, "expected a session");
  assert.equal(session.operatorId, 8);
});

test("operator viewer fails the editor gate", async () => {
  const token = await mint({ role: "operator", operatorId: 9, operatorRole: "viewer" });
  assert.equal(await requireRole(token, "editor"), null);
  assert.equal(await requireRole(token, "admin"), null);
});

test("legacy role:admin session passes any gate", async () => {
  const token = await mint({ role: "admin" });
  const session = await requireRole(token, "admin");
  assert.ok(session, "expected a session");
  assert.equal(session.role, "admin");
  // Disclosed limitation: legacy sessions carry no operatorId (§8.2 work).
  assert.equal(session.operatorId, undefined);
});

test("client session never passes an operator gate", async () => {
  const token = await mint({ role: "client", clientId: 3 });
  assert.equal(await requireRole(token, "editor"), null);
  assert.equal(await requireRole(token, "admin"), null);
});

test("unknown operatorRole fails closed", async () => {
  const token = await mint({ role: "operator", operatorId: 10, operatorRole: "superadmin" });
  assert.equal(await requireRole(token, "editor"), null);
  assert.equal(await requireRole(token, "admin"), null);
});

test("operator session missing operatorRole fails closed", async () => {
  const token = await mint({ role: "operator", operatorId: 11 });
  assert.equal(await requireRole(token, "editor"), null);
});

test("garbage token fails", async () => {
  assert.equal(await requireRole("not-a-jwt", "editor"), null);
});

test("missing token fails", async () => {
  assert.equal(await requireRole(undefined, "editor"), null);
  assert.equal(await requireRole(null, "admin"), null);
});

test("token signed with a different secret fails", async () => {
  const other = new TextEncoder().encode("a-different-secret-that-is-long-enough-to-be-valid-hs256");
  const token = await new SignJWT({ role: "operator", operatorRole: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("300s")
    .sign(other);
  assert.equal(await requireRole(token, "admin"), null);
});

test("expired token fails", async () => {
  const token = await new SignJWT({ role: "operator", operatorRole: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 600)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 300)
    .sign(secret);
  assert.equal(await requireRole(token, "admin"), null);
});

// ---------------------------------------------------------------------------
// Issue #136 (GAP-LEDGER §8.2): legacyAdminCandidateHashes — the six candidate
// policies of the env-credential retirement rule (AC-1).
// ---------------------------------------------------------------------------

const DB_PASSWORD = "db-password-123";
const ENV_PASSWORD = "env-password-456";
const dbHash = hashPassword(DB_PASSWORD);
const envHash = hashPassword(ENV_PASSWORD);

test("DB+env+0 operators: DB hash is the sole candidate", () => {
  const candidates = legacyAdminCandidateHashes(dbHash, envHash, 0);
  assert.deepEqual(candidates, [dbHash]);
  assert.equal(verifyPasswordAgainstHash(DB_PASSWORD, candidates), true);
  assert.equal(verifyPasswordAgainstHash(ENV_PASSWORD, candidates), false);
});

test("DB+env+operators present: DB hash is the sole candidate", () => {
  const candidates = legacyAdminCandidateHashes(dbHash, envHash, 3);
  assert.deepEqual(candidates, [dbHash]);
  assert.equal(verifyPasswordAgainstHash(DB_PASSWORD, candidates), true);
  assert.equal(verifyPasswordAgainstHash(ENV_PASSWORD, candidates), false);
});

test("no DB hash + env + 0 operators: env hash accepted (bootstrap window)", () => {
  const candidates = legacyAdminCandidateHashes(null, envHash, 0);
  assert.deepEqual(candidates, [envHash]);
  assert.equal(verifyPasswordAgainstHash(ENV_PASSWORD, candidates), true);
});

test("no DB hash + env + operators present: no candidates, env rejected", () => {
  const candidates = legacyAdminCandidateHashes(null, envHash, 1);
  assert.deepEqual(candidates, []);
  assert.equal(verifyPasswordAgainstHash(ENV_PASSWORD, candidates), false);
});

test("no hashes at all: no candidates", () => {
  assert.deepEqual(legacyAdminCandidateHashes(null, null, 0), []);
  assert.deepEqual(legacyAdminCandidateHashes(undefined, undefined, 0), []);
  assert.equal(verifyPasswordAgainstHash(ENV_PASSWORD, []), false);
});

test("malformed selected hash: verification is false without throwing", () => {
  const candidates = legacyAdminCandidateHashes("not-a-bcrypt-hash", envHash, 0);
  assert.deepEqual(candidates, ["not-a-bcrypt-hash"]);
  let result: boolean | undefined;
  assert.doesNotThrow(() => {
    result = verifyPasswordAgainstHash(DB_PASSWORD, candidates);
  });
  assert.equal(result, false);
});
