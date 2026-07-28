# Gap Ledger — deep audit, 28 July 2026

> **162 verified defects** across 8 subsystems. Nine specialist auditors read the code;
> an adversarial verifier then tried to refute every finding and rejected 8. What remains
> was confirmed against the source.
>
> Companion to [`STATE-OF-THE-BUILD.md`](./STATE-OF-THE-BUILD.md) (the structural audit).
> This document is the detailed ledger and, more importantly, the **root-cause analysis**.

| Dimension | Confirmed | Plausible |
|---|---|---|
| Frontend quality | 24 | 0 |
| Operational / deployment | 22 | 0 |
| Delivery correctness | 19 | 5 |
| API contracts | 17 | 2 |
| WordPress plugin (PHP) | 16 | 2 |
| Silent failure | 14 | 5 |
| LLM pipeline | 14 | 5 |
| Data integrity | 12 | 5 |
| **Auth / authz / tenancy** | **10** | **0** |

---

## The verdict

**These are not 162 independent bugs. They are seven root causes stamped out once per
route across 53 route handlers.**

The through-line: this codebase was optimised to produce **success-shaped responses
rather than observed effects** — because the only verifier in the loop was
`tsc --noEmit` plus a human reading a PR body. The repo is the proof: 0 tests, 0 test
script, 0 `db().transaction()` calls, 0 `CREATE INDEX`, 0 `FOREIGN KEY`, 0 sanitizers,
no validation library, 68 catch blocks, and a CI job that builds on Node 20/glibc while
the artifact ships on Node 22/musl and is never built at all.

### The single most damning finding

A repo-wide case-insensitive grep for `publish` across every `.ts`, `.tsx` and `.php`
file **returns nothing.**

The entire advertised pipeline — intake, generate, provision, push — terminates in five
**invisible drafts** titled Home / Services / Gallery / Contact / About on the client's
site, with no front page configured, while three separate UI surfaces render
"✓ Pushed to WP" and the dashboard counts it as delivered.

And on the way to that non-delivery:
- The first push **adopts and rewrites the client's existing published pages** by
  unnamespaced slug — a client with a real `/about` page loses it.
- A failure on page 3 of 5 **discards every WordPress id it just created**, and because
  the dedupe lookup omits `status` it cannot see its own drafts, so the retry duplicates
  everything.

**The honest statement of current capability is that this system cannot deliver a
website.** It is not an application with a defect backlog; it is a demo with a
production-shaped UI.

---

## ⚠️ The sequencing landmine — read before touching anything

**Roughly 35 of these 162 findings are latent behind a single dead call.**

`assignProjectToClient` is never called, so `sites.client_id` is always NULL, so the
entire change-request subsystem is unreachable — and therefore untested and unexercised.
**Wiring `client_id` detonates all of it at once.**

The first real client change request would: branch from a stale version, silently revert
the previous request's changes, drop the client link and connection id, push to the wrong
site, report a fabricated page count, mark itself completed, and email the client that it
is live.

**Order of operations is not optional:**

1. The change-request state machine (conditional `UPDATE … WHERE status IN (…)` that
   checks `changes`)
2. The apply route's per-page failure accounting
3. Group-head / version resolution
4. **Only then** make `client_id` settable

Doing step 4 first is the single most expensive mistake available in this codebase.

---

## The seven root causes

Each pattern has one systemic fix. Fixing the pattern is worth more than fixing its
instances, and the instances will otherwise regenerate.

### 1. Success is a returned shape, never an observed effect

Not one effectful function returns a result derived from what actually happened.

- DB writers return `void` and never read `info.changes` — a bare `UPDATE … WHERE id = 1`
  against a row that was never seeded reports "Saved".
- `installWordPress` falls through a missing `else` to a fabricated `{id: 0, url: …}`, and
  the route never inspects the `0`.
- Counters are computed outside the loop meant to increment them (`pushed =
  editedPages.length`).
- 68 catch blocks, several with no logging at all — including the sole audit-trail writer.
- The WordPress plugin discards `wp_remote_post`'s return value entirely.

**The invariant against this is already written** in
[`AGENT-TIERS.md §4`](./AGENT-TIERS.md) and [`NORTH-STAR.md`](./NORTH-STAR.md) Invariant 4,
and it is still violated in every subsystem — which proves exhortation does not work here.
**The constraint has to be mechanical.**

> **Systemic fix.** Ban `void` returns and bare catches at the type and lint level, not in
> prose. Every `lib/db.ts` writer returns `changes`; every route answers 500 when
> `changes === 0`. Every outbound call (`lib/wp.ts`, `lib/plesk.ts`, `lib/email.ts`, the
> plugin's `wp_remote_post`) returns a discriminated union
> `{ok: true, …} | {ok: false, reason, status, body}` with **no fabricated-success branch
> and no default fallthrough**. Add an ESLint rule set that fails the build on `catch {}`,
> on catches with no log or rethrow, and on any `NextResponse.json({ok: true})` whose
> truthiness is not derived from a checked variable — then delete the ~68 existing
> violations in one mechanical sweep. Add `lib/log.ts` and require every catch to call it
> with a correlation id.

### 2. No trust boundary is parsed — types are treated as runtime guarantees, both directions

No validation library, no sanitizer, `as` casts standing in for parsing at every boundary.

*Inbound:* `/api/generate` validates two fields then `input.services.map` throws a
TypeError reported to the operator as a 502 AI failure. `original.theme_id as ThemeId`
casts a `"template-7"` string into an enum the compiler accepts. `nl-edit/apply` writes
whatever HTML the browser sends after a truthiness check. No route checks
`Content-Length`, and the one **unauthenticated** route buffers `await req.text()` before
any validation. URLs are stored with no scheme or private-range check — making both the
scanner and the public pairing endpoint **SSRF primitives**.

*Model-ward:* the completion is coerced with `?? ""`. `cleanHtml` only strips a fence at
position 0, so one word of preamble leaves **prose and both fence markers baked into a
client's published page**. `finish_reason` and `refusal` are never read. The result goes
straight into `pages_json`, the export ZIP, an **unsandboxed same-origin iframe**, and the
client's live WordPress.

> **Systemic fix.** One runtime-schema layer (`lib/contracts.ts`); crossing a boundary
> without it is a lint failure. Every route's first statement parses the body with explicit
> length and shape caps. Every completion is shape-asserted (non-empty, `<html`…`</html>`,
> `finish_reason === 'stop'`, no refusal) before it can persist. Add
> `lib/net.ts::assertPublicHttpTarget(url)` — scheme allowlist plus DNS resolution and
> loopback/RFC1918/link-local/ULA rejection — called before **every** server-side fetch and
> again on every redirect hop. Add `lib/sanitize-html.ts` as a single chokepoint at persist
> *and* egress. Assert env at boot from `instrumentation.ts` so the process exits non-zero
> on missing config. Map all errors through one classifier so no raw provider message
> reaches a client. Forbid `as` across boundaries in ESLint.

### 3. The data model has no identity, no head pointer, and no lifecycle

`sites` conflates a site with a version of a site. `/projects` renders every version as a
peer card, all badged with the same count; the "pushed" badge lands on whichever row holds
`wp_page_ids` rather than the newest; Delete removes one version; **there is no way to
delete a site, or to answer "which version is live?"**

WordPress page identity is re-derived from a fixed, non-namespaced slug map instead of
stored ownership — which is exactly why the first push overwrites the client's existing
pages, and why two projects on one connection can both claim the same page ids.
`theme_id` holds two disjoint namespaces with no discriminator. Provisioned hosts and
delivered pages **have no table at all**.

Underneath: no migration framework, zero foreign keys, zero CHECK constraints, zero
indexes, **zero transactions in the entire repo** — so `insertProject` commits the row and
*then* sets its group id in a second autocommit.

> **Systemic fix.** A real migration framework with a `schema_version` row. Then normalise:
> `sites` becomes identity with `head_version_id`; `site_versions` holds the content;
> **`delivered_pages(connection_id, page_key) UNIQUE`** owns `wp_page_id`, slug, status,
> url and `pushed_at` — so page ownership is *stored*, and adopting a page the platform did
> not create becomes structurally impossible; `provisioned_hosts` records every Plesk domain
> *before* the call is made. Add foreign keys with explicit `ON DELETE`, CHECK constraints on
> every status/role column, indexes on the hot paths, and `journal_mode=WAL` +
> `busy_timeout=5000`. Then the absolute rule: **no multi-statement write outside
> `db().transaction()`**, and every INSERT supplies its identifiers inline.

### 4. Expensive multi-step external work runs inline in one HTTP request

Five sequential model calls (60–100s), a 5-page push, a two-call Plesk provision, and a
change-request apply doing 5 edits plus 5 pushes — **all inside a single request handler**
with no job row, no deadline, no `AbortSignal`, no idempotency key, and all-or-nothing
persistence at the end.

The OpenAI client uses SDK defaults (600s × 3 attempts), so one wedged call can hold a
request open ~30 minutes per page while the proxy 504s the operator — who clicks Generate
again and pays twice. Two operators can both pass a status check separated by 30s of
awaited model calls and both bill a full run. **A repo-wide grep for `.usage` hits only a
comment** — there is no per-project cost, no budget ceiling, no way to notice a runaway.

> **Systemic fix.** A `jobs` + `job_steps` table and one durable step runner that every
> multi-step external operation goes through. Each step checkpoints before the next begins,
> carries a deterministic idempotency key `(job_id, step_id)` enforced in the client wrapper
> (a call without one fails CI), retries with bounded jittered backoff only on retryable
> classes, and lands in an explicit terminal DLQ state with partial artefacts intact plus a
> "resume from step N" action. Routes return a job id immediately; the UI subscribes to
> resumable SSE with `Last-Event-ID`. Wrap every model call in one
> `lib/openai.ts::callModel()` that sets explicit timeout / maxRetries / max_tokens, threads
> `req.signal`, records tokens and cost to an `llm_calls` row, and throws
> `BudgetExceededError` before breaching a per-tenant ceiling.

### 5. Secrets are minted, transmitted, and abandoned

Nothing the platform creates has a rotation or revocation path.

Provisioning generates an FTP login, an FTP password and a WP admin password with
**`Math.random()`** plus a biased comparator shuffle, sends them to Plesk, and returns
none of them — a live hosting account exists that **nobody can authenticate as**, and the
platform holds no record it exists.

`health_secret` is disclosed once with no rotate endpoint, and is **never issued for
manually-added connections** — so those can never report health, and the UI cannot
distinguish "never reported" from "cannot report".

WordPress-side, the Application Password is created **before** the platform validates
anything, is never revoked on any failure path, is never revoked on Disconnect, survives
plugin deletion (no `uninstall.php`), and — because its name is a hardcoded constant that
WP core rejects as a duplicate per user — **permanently locks that admin out of ever
re-pairing.** (This is the root cause of the pairing failures observed in this session.)

SSO decides *who to log in* from an unauthenticated remote response body over a channel
the deployment forces to plain HTTP, then issues a 14-day remembered cookie. And there is
**no PATCH handler on clients, operators or connections anywhere** — no password reset, no
rotation, no email correction. The only remedy is delete-and-recreate, which dangles every
dependent row.

> **Systemic fix.** Make every secret an object with a lifecycle, not a value passed along.
> One `lib/credentials.ts` issues all of them via `node:crypto` (`randomInt`/`randomBytes`,
> Fisher–Yates, never `Math.random`), records owner/scope/created/rotated/revoked in a
> `credentials` table **before** the external call, and exposes explicit rotate and revoke
> endpoints wired into every offboarding path. **Invert create-then-validate everywhere:
> authorise first, mint second** — validate the pairing code before the outbound fetch and
> before the Application Password exists, and delete the password on every early-return
> failure path. Add PATCH handlers with `hasOwnProperty` semantics. HMAC-sign the SSO
> validation response over token+timestamp keyed on the health secret, require https for
> `platformUrl`, pin the username against the paired value, set `$remember` false, and accept
> the token by POST only.

### 6. The UI is a second, independent source of truth that never reads the server's answer

There is no shared convention for "the state of an async action", so every page reinvents
it and most reinvent it wrong.

On the project page, **five of six `setError` call sites are unrenderable** — the only
error render while `status === 'ready'` is nested inside a collapsed panel, so
"Push to WordPress" failing on a rotated password **changes nothing on screen**. The
generator never reads `result.id`, the documented save signal, so a swallowed DB write
renders identically to success. Three incompatible response envelopes coexist, including
HTTP 200 carrying `{ok: false}`; the connections page only works because it ignores
`res.ok` entirely.

Worst: **settings sub-sections ignore `res.ok` on load, render from empty initial state,
then persist those empty defaults over the agency's real branding, SMTP and Plesk config.**
The Application section transmits `openaiApiKey: ""` on every save and deletes the stored
key.

`grep confirm(` returns **zero** — nothing confirms any delete, including the hard,
unrecoverable DELETE of the row holding every generated page. There is no `error.tsx`, no
`global-error.tsx`, and **zero `aria-live` or `role="alert"` in the whole app**, so a
60-second generation finishing or failing is announced to nobody.

> **Systemic fix.** One response envelope in `lib/api-response.ts` (success = the resource;
> failure = `{error: {code, message}}` with a correct status) through all 53 handlers, so
> `res.ok` is authoritative and 200-with-`ok:false` disappears. Then one `useAction()` hook
> plus an `<ActionStatus>` component that is the **only** permitted way a page mutates: it
> owns idle/pending/error/success, disables the trigger in flight, refuses to render success
> unless the parsed response says so, renders `role="alert"`/`role="status"` unconditionally
> at page level, and requires a confirm predicate for destructive actions. Delete every
> hand-rolled `error` useState after. Add the three error boundaries, and make failed loaders
> render read-only with Retry and a disabled Save so empty defaults can never persist.

### 7. The deployable artifact is never exercised

CI is four steps: checkout, `setup-node@20`, `npm ci`, `tsc --noEmit`, `next build`.

The artifact ships on `node:22-alpine` (musl), so **neither `better-sqlite3`'s nor
`sharp`'s musl bindings are ever exercised**. The Dockerfile's own
`npm rebuild better-sqlite3` hedge runs *after* the build into a directory the runner stage
never copies — it is inert. There is no `docker build` in CI, no smoke test, no
healthcheck, no `/api/health` route (and a naive one would be 401'd by the middleware
matcher).

**Nothing ever ran the product end to end** — which is precisely why the pipeline never
publishes, why the built-in template's Home link points at `home.html` while both archive
builders write `index.html`, why home-only mode ships four dead nav links, why the static
export injects a second nav over the page's own, and why **the documented backup command
names a volume Compose never creates — so it copies nothing at all while the operator
accumulates zero backups.**

The WordPress plugin — 23KB of PHP holding an admin Application Password and an
unauthenticated login endpoint on every client site — is **untracked in git**, doubly
nested, shipped beside two out-of-sync hand-built zips, with no update channel.

> **Systemic fix — do this before anything else, because every other pattern is downstream
> of it.** A CI job that runs `docker build .`, boots the image with a throwaway `.env`
> alongside a **real WordPress container** and a mocked OpenAI, then executes a smoke script
> asserting the golden path: `/api/health` returns 200 with the resolved DB path and git sha,
> login succeeds, a generation produces five shape-valid pages, a push creates pages, **a
> publish makes them fetchable at a real URL with a 200**, and every internal link in the
> exported ZIP resolves to a file present in the archive. Pin Node once via `engines` +
> `.nvmrc` + `node-version-file`. Delete the inert rebuild. Build and push
> `ghcr.io/…:${sha}` so rollback is a version edit, not a rebuild on prod. Commit the plugin
> into the tree with a versioned build script. Add a nightly job that **restores from the
> documented backup command and asserts a row count** — a backup procedure that has never
> been restored is not a backup.

---

## 8. Authorization is one boolean gate — there is no defence in depth

*Added after the auth/tenancy audit completed. This dimension is severe enough to stand
apart from the seven patterns.*

**50 of 54 API routes have no in-handler auth at all.** They inherit "any valid session,
any role" from `middleware.ts`. There are exactly three hand-rolled role checks in the
entire codebase, and all three guard operator CRUD.

### 8.1 Any operator role — including `viewer` — gets WordPress administrator on every client site, unlogged · **critical**

You already knew `editor`/`viewer` were unenforced. **This is the blast radius:** not the
dashboard, but *root on production WordPress for every client*, with no audit trail and no
attribution.

`app/api/wp/connections/[id]/login-token/route.ts` **never reads the session** — it does not
import `@/lib/auth` at all. So a `viewer`:

1. `GET /api/wp/connections` → every connection id
2. `POST /api/wp/connections/7/login-token` → a live SSO URL
3. Opens it. The plugin calls `wp_set_current_user()` + `wp_set_auth_cookie($id, true)` and
   redirects to `/wp-admin`
4. They are now the client's WordPress **administrator** — plugin/theme editor, user
   creation, PHP execution. Repeat for every id.

The same missing check hands a `viewer`: `DELETE /api/wp/connections/[id]` (destroy any
client's credentials), `sync-settings` with `{"blog_public":0}` (**silently de-index every
client's site from search** — it is an allow-listed option, so a supported write), and
`POST /api/change-requests/[id]/apply` on `pending` requests, skipping approval entirely.

Two aggravators: **the most sensitive action in the product is the one action that does not
call `logActivity`** — `push_wp`, `plesk_provision` and `deliver_template` all do. And
attribution is impossible even if you added it: a legacy `role:"admin"` session carries no
`operatorId`, and the token never records who requested it, so WordPress logs "admin logged
in" identically for every operator.

> **Fix:** require `operatorRole === "admin"` in `login-token/route.ts` (mirror
> `requireAdmin`), add `logActivity({eventType:"wp_sso", operatorId})`, then add a shared
> `requireRole(req, minRole)` and apply it to `sync-settings`, `settings`,
> `DELETE /connections/[id]` and `change-requests/[id]/apply`. Longer term, mint a distinct
> WP user per operator instead of reusing the paired admin.

### 8.2 The legacy admin password is an unrevocable, password-only path to top privilege · **high**

Three defects compose:

- It grants `role:"admin"` — the top of the ladder, accepted unconditionally by both admin
  gates. It can create and delete operator accounts.
- **It triggers on any email that is not an operator.** So the whole authentication surface
  reduces to guessing *one password with no username* — and with no rate limiting, at any
  rate. The same secret is accepted at a second public endpoint (`/api/login`), and both are
  in `PUBLIC_PATHS`, so **a logged-in client can reach them and escalate to admin.**
- **Rotating the password does not revoke the old one.** `POST /api/app/password` writes the
  new hash but leaves `ADMIN_PASSWORD_HASH` intact, and `verifyPasswordAgainstHash` accepts
  *either*. So: `.env` leaks → operator correctly rotates via Settings → **the leaked
  credential still works forever, at both endpoints, still as admin.** No code path can
  disable it. `countAdmins()` can legitimately reach 0 while this shadow admin exists.

> **Fix:** accept the env hash only when `operators` is empty AND
> `app_settings.admin_password_hash` is empty; do not fall through on an unmatched email;
> record env-credential retirement on password change and refuse it thereafter.

### 8.3 ✅ Unauthenticated SSRF via `pairing/register` — **fixed and tested this session**

**This was a regression introduced during this session.** The credential-verification gate
added to `app/api/wp/pairing/register/route.ts` was placed *before* `consumePairingCode`, so
an unauthenticated caller could make the server fetch any URL — a full internal port and host
scanner, with the error text (`HTTP 401` / `ECONNREFUSED` / `timed out`) as a discriminating
oracle, plus attacker-chosen Basic-Auth credentials attached to every probe.

Good intent (don't burn a one-time code on a failed pairing), wrong order — a textbook
example of the "plausible but wrong" change this documentation set exists to prevent.

**Fixed:** the code is now validated with a non-consuming `getPairingCode()` peek *before*
any outbound request, and consumed atomically only after verification succeeds — so
retry-friendliness is preserved *and* an unauthenticated caller cannot trigger a fetch.
Added `lib/net.ts::assertPublicHttpTarget()` (scheme allowlist + DNS resolution + rejection
of loopback, RFC1918, link-local, CGNAT, multicast and IPv4-mapped-IPv6) as defence in depth.

**Covered by `lib/net.test.mts` — the repo's first test, 31 cases.** It immediately earned its
keep: it caught a live bypass where the WHATWG URL parser normalises `::ffff:127.0.0.1` to
`::ffff:7f00:1`, which the original dotted-quad check missed.

### 8.4 Remaining auth findings

| # | Finding | Severity | Tier |
|---|---|---|---|
| 8.5 | **SSO tokens travel in a URL query string** to a third-party host — landing in the client's access logs, any WAF/CDN in front, the operator's browser history, and the `Referer` sent to `/wp-admin`. Not bound to a user or IP, so anyone reading it from a log within 5 minutes becomes the WP admin. `validate-login-token` is public and unauthenticated, so a log-scraper can consume the token directly — denying the operator their login while disclosing the WP admin username | medium | T3 |
| 8.6 | **Health reports are replayable forever.** No nonce, no timestamp, no signature; the secret is a static bearer token **returned in the pairing-register response body** over a channel the plugin permits to be `http://`. An attacker who sees it once can pin `healthScore: 10` / `wpVersion: "6.8"` permanently — so a site reads "healthy, current" while running an exploitable WordPress. No rate limit, no logging | medium | T2 |
| 8.7 | **Authenticated SSRF with content read-back** via `/api/templates/from-scan`. Any role including `viewer`. Validates the scheme but no host; follows 3 redirects **re-resolving `Location` with no re-validation**, so a public URL can bounce to an internal host. The HTML is LLM-reproduced and returned — a `viewer` can read internal Grafana/Kibana/admin panels. `assertPublicHttpTarget` now exists; apply it here **and on every redirect hop** | medium | T2 |
| 8.8 | `verifyHealthSecret` is **not** constant-time and its comment falsely claims it is (`Buffer.equals` is `memcmp`, which short-circuits). The length check also leaks length. Not realistically exploitable — the reason to fix it is that a false security claim sits on a security check, in two places | low | T1 |
| 8.9 | **`/logout` is a state-changing GET** and clears the cookie unconditionally without reading the session — so any page can force-log-out an operator. The only state-changing GET of 21 | low | T1 |
| 8.10 | Pairing codes use `Math.random()` (xorshift128+, state-recoverable) while a correct CSPRNG helper sits 440 lines away in the same file. Not currently exploitable — gratuitous | low | T1 |
| 8.11 | **`isAdmin()` — an authorization function whose entire body is `return true`**, with zero callers, sitting in the one file that does role checks correctly. A landmine for the next person who adds an admin-gated route there | low | T1 |

### ✅ Verified sound — stop spending effort here

The audit explicitly cleared these, which is as valuable as the findings:

- **Next.js is 15.5.21**, past the 15.2.3 fix for CVE-2025-29927 (`x-middleware-subrequest`
  middleware bypass). This matters enormously — a bypass would have unlocked all 50
  unprotected handlers.
- **No IDOR is reachable by a client.** There is no `/api/portal/[id]` at all; all three
  portal handlers scope exclusively on `session.clientId` from the signed JWT, and the one
  client-supplied id is ownership-checked before use.
- **Cross-role reachability is closed both ways** — client → non-portal API is 403,
  operator → portal API redirects. No leak found in either direction.
- **The two public regex exemptions fail closed** on malformed input (`\d+` required, so
  `/connections/abc/health-report` is treated as protected and 401s).
- **SSO token mechanics are correct** — connection-bound (`WHERE token = ? AND
  connection_id = ?`), atomically single-use, correctly expired.
- **Secret projections are disciplined** — `app_password`, `health_secret`,
  `password_hash`, `smtp_pass`, `plesk_password` and `openai_api_key` are all excluded from
  their GET responses.
- **`getUploadPath` path traversal is blocked**, and no secrets are git-tracked.
- `SameSite=Lax` genuinely does block cross-site POST, so the ~30 state-changing routes are
  not directly CSRF-able despite zero CSRF tokens. Two residual gaps: Chrome's
  *Lax-allowing-unsafe* 2-minute grace window right after login, and the fact that cross-site
  GETs cannot exfiltrate JSON **only** because no CORS headers are configured.

### One planning consequence

Because `client_id` is permanently NULL, the ownership check at
`portal/requests/route.ts:47` always evaluates `null !== clientId` and returns 403. **The
tenant-isolation logic is correct by inspection but has never actually executed.** The moment
`assignProjectToClient` is wired, that line becomes load-bearing for the first time.

> **Write a test asserting client B gets 403 for client A's `projectId` *before* that wiring
> lands.** Add it to the Phase 0.75 chain in [`../ROADMAP.md`](../ROADMAP.md).

---

## Blockers to enterprise-grade use, ranked

0. **`viewer-role-gets-wp-admin-on-every-client-site`** (§8.1) — any team member with a
   read-only account has WordPress administrator on every client's production site, unlogged
0b. **`legacy-admin-password-unrevocable`** (§8.2) — a leaked `.env` is permanent admin that
   rotating the password does not revoke, reachable from two public endpoints by guessing one
   password with no username
1. `nothing-is-ever-published` — the pipeline cannot deliver a site
2. `push-overwrites-clients-live-pages` — destroys client content
3. `partial-push-loses-all-page-ids` — retries duplicate
4. `wp-plugin-untracked-no-update-channel` — unpatchable code on client servers
5. `backup-cp-live-sqlite` — backups copy nothing; no restore has ever been tested
6. `unsandboxed-srcdoc-iframe-runs-model-output-in-app-origin` — stored XSS in the operator session
7. `sso-trusts-remote-username` — auth decision from an unauthenticated response body
8. `disconnect-and-uninstall-never-revoke-credential` — credentials outlive the relationship
9. `platform-url-not-validated` / `from-scan-ssrf` / `unauth-ssrf-before-pairing-auth` — three SSRF paths, one unauthenticated
10. `app-password-duplicate-name-lockout` — permanent, unrecoverable pairing lockout
11. `no-rate-limiting-anywhere` + `port-published-on-all-interfaces` + `no-request-body-size-limit`
12. `settings-subsections-wipe-config-on-load-failure` + `settings-save-clears-openai-key` — the settings page destroys configuration
13. `ci-does-not-test-deployment-artifact` — the verifier tests a different platform than production
14. `no-structured-logs-failed-delivery-invisible` — no post-hoc diagnosis is possible
15. `no-llm-cost-accounting` — unbounded spend, no per-tenant margin
16. `no-foreign-keys-anywhere` / `listprojects-conflates-versions-with-sites` / `no-delivered-url-recorded`
17. `provisioned-credentials-discarded` / `math-random-provisioning-credentials`
18. `no-update-endpoints-on-any-resource` — no password reset or rotation exists
19. `long-generation-in-request-no-queue` / `single-process-sync-sqlite-head-of-line-blocking`
20. `no-seo-artifacts-in-any-output` / `broken-tablist-and-orphan-labels` — SEO and accessibility, legally load-bearing (see [`PRODUCT-VISION.md`](./PRODUCT-VISION.md))

---

## Fix order

Strictly sequential. Each stage is a prerequisite for the next being verifiable.

| # | Stage | Why here |
|---|---|---|
| **0** | **Change the verifier** (pattern 7) | Until CI boots the image and asserts a *published* page is fetchable from a real WordPress, the loop cannot distinguish working from broken and will keep manufacturing this exact defect class faster than it can be reviewed |
| **1** | Make every effect observable (pattern 1) | Everything else is unmeasurable while success is fabricated |
| **2** | Parse every boundary (pattern 2) | Closes the SSRF and XSS paths and stops malformed data reaching storage |
| **3** | Give the data model identity (pattern 3) | Prerequisite for publish-ownership and for capability 3 in the product vision |
| **4** | Move multi-step work onto durable jobs (pattern 4) | Prerequisite for reliable delivery and for cost control |
| **5** | Give secrets a lifecycle (pattern 5) | Unblocks re-pairing, rotation, and offboarding |
| **6** | Unify the UI action contract (patterns 6) | Real and legally load-bearing, but a well-instrumented UI over a pipeline that never publishes is still worth zero |

---

## Where the raw data lives

Full per-gap detail — all 162 findings with file:line, failure scenario, evidence, fix,
effort and tier — is in the audit run journal:

```
C:\Users\newke\.claude\projects\C--Users-newke-ZCodeProject\
  4f632733-8f0e-40af-8134-3c0578d576f0\subagents\workflows\wf_536b515d-0ba\journal.jsonl
```

Extract with the helper at `scratchpad/extract.js` (`counts` | `top` | `synth` |
`research` modes). Re-run or extend the audit via the persisted workflow script in
`workflows/scripts/`.
