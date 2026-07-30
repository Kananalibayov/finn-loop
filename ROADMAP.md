# Roadmap — Finn-Loop Site Factory

Sequenced plan toward [`docs/NORTH-STAR.md`](./docs/NORTH-STAR.md).
Current state: [`docs/STATE-OF-THE-BUILD.md`](./docs/STATE-OF-THE-BUILD.md).

**Rules for this roadmap**
- Phases are ordered. Do not start a phase before the one above it is demonstrably done.
- Every phase ends with a **demo**: the Golden Path working further than it did before,
  proven against a real WordPress site.
- Each phase is a chain of one-day issues in the existing `AC-N` / `NG-N` spec format.
- Adding a feature that is not in a phase below requires updating the north star first.

## Standing product mandate · *granted by the human, 2026-07-30*

The implementing model holds **product-design authority**, not just execution authority. The
human's words: the initial build may not be the best; the model understands the direction and
may decide how this app best aligns with it — including rearranging features, redesigning the
operator UI to a 2026 standard, and adding what enterprise-grade software of this kind needs.

Within these boundaries, "not on the roadmap yet" is NOT a reason to skip something:

- **Direction is fixed, shape is yours.** NORTH-STAR.md §1–§4 (what this product is, who it
  serves, the quality bar) and PRODUCT-VISION.md still bind. You may reshape *how* the app
  gets there — navigation, screens, flows, feature grouping, what exists that shouldn't, what
  doesn't exist that should (audit trails, empty/loading/error states everywhere, bulk
  operations, search, keyboard support, sensible defaults — the texture of enterprise
  software).
- **Write it down first, then build.** A self-granted feature still starts as a one-line
  roadmap addition in the phase where it belongs, in the same PR as the work or ahead of it,
  citing this mandate. The record is the point: the human reviews direction *after the fact*
  through ROADMAP diffs, `docs/DECISIONS.md` and `docs/BUILD-LOG.md`, so an unrecorded
  feature is a violation even if it is good.
- **Unchanged hard limits:** the enforcement spine (gates, CI, tests, lint) is not yours to
  weaken; `lib/auth.ts`/`middleware.ts` still require a stated threat model; product intent
  that is genuinely the human's — pricing, legal claims, what is promised to clients — still
  goes to a `needs-human-review` issue with a recommendation, and you continue with other
  work.
- **Operator UI carries the same bar as generated sites:** WCAG 2.2 AA, keyboard reachable,
  visible focus, honest empty/error states, no fabricated success indicators. The dashboard
  is the product the operator buys; it is not exempt from NORTH-STAR §4.

> Supersedes the previous roadmap, whose issue numbering had diverged from reality
> (it listed #15–#17 as health/Elementor/Beaver; actual work ran to #93).

---

## Phase 0 — Change the verifier · *before any other work*

> Revised after the deep audit ([`docs/GAP-LEDGER.md`](./docs/GAP-LEDGER.md), 162 verified
> defects). **Every other pattern is downstream of this one.** Until CI boots the image and
> asserts a *published* page is fetchable from a real WordPress, the loop cannot distinguish
> working from broken and will keep manufacturing defects faster than they can be reviewed.

- [x] `/api/health` route (public in middleware) returning resolved DB path + git sha — **#103 (#117)**
- [ ] CI job: `docker build .`, boot the image with a throwaway `.env` beside a **real
      WordPress container** and a mocked OpenAI — **#104**
- [ ] Smoke script asserting the golden path: login → generate 5 shape-valid pages → push →
      **publish → page fetchable at a real URL with 200** → every internal link in the
      exported ZIP resolves to a file in the archive — **#107**
- [x] Pin Node once (`engines` + `.nvmrc` + `node-version-file`) so CI and the image agree —
      done in #108; CI and the Docker artifact both run Node 22
- [ ] Delete the inert `npm rebuild better-sqlite3` step
- [x] Add `npm test` to CI — done in #108 (46 passing, including a route-auth ratchet over
      GAP-LEDGER §8)
- [ ] Add `npm run lint` to CI with ESLint rules banning `catch {}`, unlogged catches, and
      `{ok:true}` not derived from a checked variable — **#109** (`next lint` is currently
      interactive/broken and would hang CI; fix that first)
- [ ] Build and push `ghcr.io/…:${sha}` so rollback is a version edit, not a rebuild on prod
- [ ] Nightly job that **restores from the documented backup and asserts a row count** — the
      current documented command names a volume Compose never creates, so it copies nothing

> **Also done, ahead of this list:** the CI/merge pipeline itself was hardened — Node pin,
> `finn-gate` (mechanical merge gate reading the real CI check-run for the head SHA, not an
> Evidence block), branch protection, `label-guard`, auto-revert-on-red-main, and any tier may
> review any other tier's work (Sonnet ↔ GLM), reserving Kimi/Opus for `tier:t3` only. See
> `docs/PIPELINE.md` and `docs/AGENT-TIERS.md`. **Keep this checklist in sync as items merge —
> a stale checkbox here caused a T3 pass to re-spec already-finished work (issue #114).**

**Demo:** CI fails when a page is not actually published. Prove it by reverting the publish
step and watching the pipeline go red.

---

## Phase 0.5 — Stop the bleeding · *safety fixes, in this order*

- [ ] **Require `admin` on `POST /api/wp/connections/[id]/login-token` and log it.** Today a
      `viewer` account has WordPress administrator on every client site, unlogged — the route
      never reads the session at all. Then add a shared `requireRole()` and apply it to
      `sync-settings`, `settings`, `DELETE /connections/[id]`, `change-requests/[id]/apply`
- [ ] **Retire the legacy admin password.** Accept `ADMIN_PASSWORD_HASH` only when no
      operators and no DB hash exist; stop falling through on an unmatched email; refuse the
      env credential once rotated. Today a leaked `.env` is permanent admin that rotating
      cannot revoke, and a logged-in *client* can escalate through it
- [x] Remove the pairing debug log writing plaintext credentials to disk
- [x] Verify pairing credentials against WordPress before consuming the pairing code
- [x] **Close the unauthenticated SSRF in `pairing/register`** — validate the code before any
      outbound fetch; add `lib/net.ts::assertPublicHttpTarget()`; covered by
      `lib/net.test.mts` (31 cases, the repo's first test)
- [ ] Apply `assertPublicHttpTarget` to `template-from-url`, **including every redirect hop**
      (authenticated SSRF with content read-back, reachable by `viewer`)
- [x] `sandbox=""` on the four `srcDoc` iframes — done in #94/#105
- [ ] `assertPublicHttpTarget()` before every server-side fetch (three SSRF paths, one on an
      unauthenticated endpoint) + request body size limits + rate limiting on login
- [x] Settings sub-sections: render read-only with Retry on load failure, so a failed GET can
      no longer persist empty defaults over real branding / SMTP / Plesk config — **#196 (#215)**
- [ ] Stop transmitting `openaiApiKey: ""` on every Application-settings save
- [ ] `confirm()` on every destructive action (currently zero in the codebase)
- [ ] Plesk WP install throws instead of faking success; `provisioned_hosts` row written
      **before** the call; generated credentials returned and stored
- [ ] Replace `Math.random()` credential generation with `node:crypto`
- [ ] Bind the published port to localhost only
- [ ] `verifySessionRole` stops defaulting to `admin`
- [ ] Enforce `editor` / `viewer` server-side, or remove them from the UI
- [ ] Guided template delivery passes the synthesized theme (currently discards it)
- [ ] `savePleskSettings` / `saveEmailSettings` upsert instead of no-op

**Demo:** a red-team pass over the six blocker items finds them closed.

---

## Phase 0.75 — Defuse the client_id landmine · *strict order, do not reorder*

> ⚠️ **~35 verified defects are latent behind the single dead `assignProjectToClient` call.**
> Wiring `client_id` before these three land means the first real client change request will
> branch from a stale version, revert the previous one, drop the connection link, push to the
> wrong site, report a fabricated page count, mark itself completed, and email the client
> that it is live. This is the single most expensive mistake available in this codebase.

- [x] **1.** Change-request state machine: conditional `UPDATE … WHERE status IN (…)` that
      checks `changes`; no transition without an observed row update — **#155 (#163)**
- [x] **2.** Apply route per-page failure accounting: no fabricated counts, no swallowed push
      failures, no "completed" email on partial application — **#156 (#168)**
- [x] ~~**3.** Group-head / version resolution~~ · ~~**4.** `regenerateProject` carries ids
      forward~~ · ~~**4b.** isolation test~~ · ~~**5.** `PATCH …/client`~~ — **superseded by
      Phase 0.9.** Steps 3–5 were a careful retrofit of versioning and tenancy *onto the
      legacy blob storage*; Phase 0.9 replaces that storage, so building the retrofit first
      is pure waste. Steps 1–2 stand on their own (honest state transitions, honest
      accounting) and are done. Do not build steps 3–5.

---

## Phase 0.9 — Foundation rebuild · *before `write()` and before the generator migration*

**The human's decision (2026-07-30):** the app is not live and the data is disposable, so fix
the foundation now, while it costs nothing to change. Do not carefully retrofit the legacy
tables. The five items below; the implementing model owns the design details and records them
in `docs/DECISIONS.md`.

> **Why:** `sites` stores each site as opaque `input_json`/`pages_json` text blobs, while
> Phase 1 built a structured, validated `SiteModel`. Three committed capabilities are
> *impossible* on blob storage — section-level editing that patches model nodes, version
> diff/revert, and idempotent re-push that respects client edits. And tenancy today is a
> nullable, FK-less `client_id` bolted on via `ALTER TABLE`, so isolation depends on every
> query remembering to filter — the root of the ~35-defect landmine above. Replace the
> ground, delete the landmine, instead of tiptoeing around it.

- [ ] **Versioned SiteModel storage.** A `site_model_versions` table: one immutable row per
      version (`isSiteModel`-validated JSON), project row carries a `head_version_id`
      pointer. New generation writes here; a version is never mutated, only superseded.
      Legacy `pages_json` projects stay readable exactly as today — no destructive migration,
      old projects render until retired.
- [ ] **Tenancy as a hard wall, not a column.** Client ownership `NOT NULL` + real foreign
      key (`ON DELETE RESTRICT`) on the new tables, and one scoped data-access layer (all
      reads/writes go through an accessor that *requires* the tenant) so an unscoped query is
      unwritable, not merely forbidden. Includes the client-B-gets-403 isolation test from
      old step 4b. This deletes the landmine class rather than defusing it bomb by bomb.
- [ ] **One identity model.** A single principal/session shape for operators and portal
      clients; `verifySessionRole` stops defaulting to `admin`; `editor`/`viewer` enforced
      server-side (folds the two Phase 0.5 auth lines in). Auth boundary files still require
      a stated threat model per the standing rules.
- [ ] **SQLite WAL + `busy_timeout`.** The one-line concurrency fix, now.
- [ ] **DB-backed job queue for generation and delivery.** Long LLM calls move out of HTTP
      handlers into observable, resumable job rows (status, attempts, last error). No new
      dependency unless justified in `docs/DECISIONS.md`.

**Demo:** two clients, one project each; client B's request for client A's project returns
403 by test; a change request produces version N+1 with N intact and revertable; a mid-apply
failure leaves an honest job record and no completion email; `PRAGMA journal_mode` returns
`wal`.

---

## Phase 1 — The Section Registry · *the quality rebuild*

The core architectural change. See [`NORTH-STAR.md §5`](./docs/NORTH-STAR.md) and
capability 1 in [`PRODUCT-VISION.md`](./docs/PRODUCT-VISION.md).

**The decision this phase makes:** the model emits `{section_id, variant, slot_values}` plus
a token document — **never markup**. That is what makes a sanitizer unnecessary rather than
merely absent, and it is the destination for the entire HTML-validation debt.

- [x] `SiteModel`, `Brand`, `DesignTokens`, `Page`, `Section`, `MediaRef` types — **#139 (#144)**
- [x] Section registry, versioned: `hero`, `services`, `about`, `features`, `testimonials`,
      `gallery`, `faq`, `cta`, `contact` — 2 variants each, responsive and WCAG 2.2 AA by
      construction (24px targets, no drag-only interactions, focus never obscured,
      consistent help affordance — all enforced at token level) — **registry #206–#208;
      styled #216–#223 (#218/#220/#222/#226)**
- [x] Registry completion: `team`, `pricing`, `stats`, `logos`, `steps` — the remaining five
      `SECTION_TYPES` already shaped in `lib/site-model.ts` (#144), same bar as the line
      above: 2 variants each, token-driven, WCAG 2.2 AA by construction — **registry #207;
      styled #218/#220/#222/#226**
- [x] Stable `(section_id, variant, registry_version)` instance ids emitted into rendered
      output — **required now**, because capability 3 cannot be retrofitted — done in the
      registry: `data-section-instance="<type>-<variant>-v{REGISTRY_VERSION}-<index>"`
- [x] `renderHtml(model)` → generated `theme.json` + one real stylesheet, not inline
      `<style>` per page — **theme-json.ts + shared `/style.css`; inline styles are a
      blocking validateSite gate (#211)**
- [ ] `plan(brief)` → `SitePlan` via one JSON-schema LLM call
- [ ] `write(plan, brief)` → slot values via small parallel JSON-schema calls, shape-asserted
      before persist (`finish_reason === 'stop'`, no refusal, non-empty)
- [x] `validate(model)` → the [§4 quality gates](./docs/NORTH-STAR.md), blocking — **#211**
- [ ] Real imagery: client uploads + licensed stock. Retire `picsum.photos`
- [ ] Migrate the existing generator; keep old projects readable

**Demo:** a generated site scores ≥ 90 Lighthouse across the board, renders correctly at
360–1920 px, every page shares one token set, and the model provably cannot emit an
off-palette colour.

---

## Phase 2 — Intake and planning · *the front door*

- [ ] Public intake form: business facts, goals, brand assets, tone, competitors,
      reference sites, must-have pages. Rate-limited and spam-protected
- [ ] Submission → structured `Brief`, stored and editable by an operator
- [ ] Template matching: brief → best-fitting template + section plan, with a stated
      reason and a confidence score
- [ ] **Human gate ①**: operator sees the plan, can swap template or sections, one click
      to approve. Approving with no edits is the default path
- [ ] Templates become token presets + default section plans (not frozen HTML);
      screenshot and URL intake produce tokens + a plan

**Demo:** a form submitted from a browser produces an approved plan and a built site
with two clicks and no typing.

---

## Phase 3 — WordPress delivery that actually works

- [ ] `renderGutenberg(model)` → native `wp-block-*` markup *(default target)*
- [ ] Media library upload: every image uploaded, `wpMediaId` recorded, URLs rewritten
- [ ] Navigation rewritten to real WordPress permalinks
- [ ] Publish pages (not drafts), set the static front page, build the WP nav menu
- [ ] `renderTheme(model)` → generated lightweight theme for full-control delivery
- [ ] Re-push is idempotent and does not destroy client edits

**Demo:** one click takes an approved site to a live, published, correctly-styled
WordPress site with working navigation and real images in the media library.

---

## Phase 4 — Provisioning · *one click to live hosting*

- [ ] `HostingProvider` interface; Plesk refactored behind it
- [ ] Hostinger provider
- [ ] SSL issuance, DNS where the API allows it
- [ ] Provision → install WP → install and pair the plugin → deliver, as one action
- [ ] Provisioned credentials stored encrypted and surfaced to the operator

**Demo:** from an approved site, one click produces a live site on a fresh domain with
no visit to a hosting panel.

---

## Phase 5 — Review loop

- [ ] Shareable client preview link (tokenised, no login)
- [ ] Section-level plain-English editing: patches `SiteModel` nodes, never regenerates
      a page
- [ ] Version diff and one-click revert
- [ ] **Human gate ②**: explicit approve-for-delivery state on a project
- [ ] Change requests become structured edits against the model

**Demo:** a client reviews a preview link, requests two changes in plain English, and an
operator approves and delivers — without hand-editing anything.

---

## Phase 6 — Builder targets

- [ ] `renderElementor(model)` → `_elementor_data` per page
- [ ] `renderBeaver(model)` → Beaver layout data
- [ ] Target picker at delivery; parity tests that all targets render the same model

**Demo:** the same site delivered three ways — theme, Elementor, Beaver — from one model.

---

## Phase 7 — SEO platform and CRM integration

- [ ] `lib/integrations/crm/`: inbound lead → Brief; outbound project status;
      `external_lead_id` on projects
- [ ] `lib/integrations/seo/`: keyword and SERP data feed page selection and copy
- [ ] On launch: register the site with the SEO platform and hand off to the content engine
- [ ] Single source of truth for a client across all three systems

**Demo:** a CRM lead becomes a live, SEO-registered website without leaving the CRM
record.

---

## Phase 8 — Scale and hardening

Only once the line above is working. Driven by the scale decision in
[`STATE-OF-THE-BUILD.md`](./docs/STATE-OF-THE-BUILD.md).

- [ ] Encryption at rest for all credentials
- [ ] Indexes; retire the `wp_settings` singleton; fix orphan/dangling deletes
- [ ] SQLite WAL + `busy_timeout`, **or** migrate to Postgres if multi-tenant is the target
- [ ] Background job queue for generation and delivery
- [ ] Retention for `activity_log`, login tokens, pairing codes
- [ ] Backups that are safe to take on a running database
- [ ] TLS, session revocation, login rate limiting

---

## Deliberately not scheduled

Per [`NORTH-STAR.md §8`](./docs/NORTH-STAR.md): public self-service builder, hosting
control panel, e-commerce, custom app logic in client sites, third-party theme support,
existing-site migration.
