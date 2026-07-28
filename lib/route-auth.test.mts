// Route authorization inventory — a RATCHET, not a pass/fail audit.
//
// docs/GAP-LEDGER.md §8 is the highest-severity finding in the repo: authorization is
// "one boolean gate in middleware.ts plus three hand-rolled role checks", and 41 of 53
// API routes have no in-handler auth at all. That is why a `viewer` account could reach
// WordPress admin on every client site.
//
// Fixing all 41 at once is not safe or reviewable. So this test does the next best thing:
// it makes the CURRENT state explicit and prevents it getting worse. A NEW route must
// either call an auth helper or be deliberately listed. Forgetting is now a CI failure
// rather than something a reviewer has to notice.
//
// THE RULE: MIDDLEWARE_ONLY_BASELINE may only ever SHRINK. Removing an entry (by adding
// real auth to that route) is the win. Adding an entry means you are widening the
// known-vulnerable surface and must say so explicitly in review.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const API_DIR = join(process.cwd(), "app", "api");

/** Any of these in a route file counts as declaring its own authorization. */
const AUTH_HELPERS = /\b(requireRole|requireAdmin|verifySessionRole|verifySession|verifyHealthSecret|consumeLoginToken)\b/;

/**
 * Deliberately reachable without a session. Each is either in middleware.ts
 * PUBLIC_PATHS or is guarded by its own secret/token rather than a session.
 */
const PUBLIC_ROUTES = new Set([
  "app/api/login/route.ts",
  "app/api/operators/login/route.ts",
  "app/api/portal/login/route.ts",
  "app/api/wp/pairing/register/route.ts",
  // Secret- and token-guarded, matched by regex in middleware.ts:20-21.
  "app/api/wp/connections/[id]/health-report/route.ts",
  "app/api/wp/connections/[id]/validate-login-token/route.ts",
]);

/**
 * Routes that predate `requireRole` and rely on middleware alone for authorization.
 * Middleware proves *a* valid session exists; it does NOT check operator role, and it
 * does NOT check resource ownership.
 *
 * THIS LIST MAY ONLY SHRINK. See docs/GAP-LEDGER.md §8.1 and ROADMAP.md Phase 0.5.
 */
const MIDDLEWARE_ONLY_BASELINE = new Set([
  "app/api/activity/route.ts",
  "app/api/branding/route.ts",
  "app/api/change-requests/[id]/route.ts",
  "app/api/change-requests/route.ts",
  "app/api/clients/[id]/route.ts",
  "app/api/clients/route.ts",
  "app/api/email-settings/route.ts",
  "app/api/email-test/route.ts",
  "app/api/export/single-html/route.ts",
  "app/api/export/static-zip/route.ts",
  "app/api/generate/route.ts",
  "app/api/plesk/provision/route.ts",
  "app/api/plesk/settings/route.ts",
  "app/api/plesk/test/route.ts",
  "app/api/projects/[id]/connection/route.ts",
  "app/api/projects/[id]/nl-edit/apply/route.ts",
  "app/api/projects/[id]/nl-edit/route.ts",
  "app/api/projects/[id]/push-wp/route.ts",
  "app/api/projects/[id]/regenerate/route.ts",
  "app/api/projects/[id]/route.ts",
  "app/api/projects/route.ts",
  "app/api/templates/[id]/deliver/route.ts",
  "app/api/templates/[id]/route.ts",
  "app/api/templates/from-scan/route.ts",
  "app/api/templates/from-screenshot/route.ts",
  "app/api/templates/route.ts",
  "app/api/uploads/[file]/route.ts",
  "app/api/uploads/logo/route.ts",
  "app/api/wp/connections/[id]/settings/route.ts",
  "app/api/wp/connections/[id]/test/route.ts",
  "app/api/wp/connections/route.ts",
  "app/api/wp/pairing/generate/route.ts",
  "app/api/wp/settings/route.ts",
  "app/api/wp/test/route.ts",
  "app/api/zip/route.ts",
]);

/** Recursively collect every route.ts under app/api, as forward-slash repo-relative paths. */
function findRoutes(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      findRoutes(full, out);
    } else if (entry === "route.ts") {
      out.push(full.replace(process.cwd() + join("/"), "").split("\\").join("/"));
    }
  }
  return out;
}

const routes = findRoutes(API_DIR).sort();

test("every API route declares auth, is deliberately public, or is a known baseline gap", () => {
  const unaccounted: string[] = [];

  for (const route of routes) {
    if (PUBLIC_ROUTES.has(route) || MIDDLEWARE_ONLY_BASELINE.has(route)) continue;
    const src = readFileSync(join(process.cwd(), route), "utf8");
    if (AUTH_HELPERS.test(src)) continue;
    unaccounted.push(route);
  }

  assert.deepEqual(
    unaccounted,
    [],
    `\n\nThese API routes have no in-handler authorization and are not listed:\n` +
      unaccounted.map((r) => `  ${r}`).join("\n") +
      `\n\nPick one, deliberately:\n` +
      `  1. Call requireRole() from lib/auth.ts  <-- do this unless you have a reason not to\n` +
      `  2. Add to PUBLIC_ROUTES in this file, if it is genuinely unauthenticated\n` +
      `  3. Add to MIDDLEWARE_ONLY_BASELINE, which WIDENS a known-vulnerable surface\n` +
      `     and must be called out in the PR (see docs/GAP-LEDGER.md §8)\n`,
  );
});

test("the baseline lists contain no stale entries", () => {
  const actual = new Set(routes);
  const stale = [...PUBLIC_ROUTES, ...MIDDLEWARE_ONLY_BASELINE].filter((r) => !actual.has(r));

  assert.deepEqual(
    stale,
    [],
    `\n\nThese routes are listed in this file but no longer exist:\n` +
      stale.map((r) => `  ${r}`).join("\n") +
      `\n\nDelete them from the list. A list that names deleted files hides real gaps.\n`,
  );
});

test("the baseline is not silently growing", () => {
  // Ratchet. Lower this number whenever you add real auth to a baseline route.
  // NEVER raise it without saying why in the PR.
  const CEILING = 35;

  assert.ok(
    MIDDLEWARE_ONLY_BASELINE.size <= CEILING,
    `MIDDLEWARE_ONLY_BASELINE has ${MIDDLEWARE_ONLY_BASELINE.size} entries, ceiling is ${CEILING}. ` +
      `Routes relying on middleware alone should be going down, not up.`,
  );
});
