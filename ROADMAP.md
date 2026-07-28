# Roadmap — Finn-Loop Site Factory

Sequenced plan toward [`docs/NORTH-STAR.md`](./docs/NORTH-STAR.md).
Current state: [`docs/STATE-OF-THE-BUILD.md`](./docs/STATE-OF-THE-BUILD.md).

**Rules for this roadmap**
- Phases are ordered. Do not start a phase before the one above it is demonstrably done.
- Every phase ends with a **demo**: the Golden Path working further than it did before,
  proven against a real WordPress site.
- Each phase is a chain of one-day issues in the existing `AC-N` / `NG-N` spec format.
- Adding a feature that is not in a phase below requires updating the north star first.

> Supersedes the previous roadmap, whose issue numbering had diverged from reality
> (it listed #15–#17 as health/Elementor/Beaver; actual work ran to #93).

---

## Phase 0 — Change the verifier · *before any other work*

> Revised after the deep audit ([`docs/GAP-LEDGER.md`](./docs/GAP-LEDGER.md), 162 verified
> defects). **Every other pattern is downstream of this one.** Until CI boots the image and
> asserts a *published* page is fetchable from a real WordPress, the loop cannot distinguish
> working from broken and will keep manufacturing defects faster than they can be reviewed.

- [ ] `/api/health` route (public in middleware) returning resolved DB path + git sha — **#103**
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
- [ ] Settings sub-sections: render read-only with Retry on load failure, so a failed GET can
      no longer persist empty defaults over real branding / SMTP / Plesk config
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

- [ ] **1.** Change-request state machine: conditional `UPDATE … WHERE status IN (…)` that
      checks `changes`; no transition without an observed row update
- [ ] **2.** Apply route per-page failure accounting: no fabricated counts, no swallowed push
      failures, no "completed" email on partial application
- [ ] **3.** Group-head / version resolution: `sites` gets `head_version_id`; queries resolve
      "which version is live" explicitly
- [ ] **4.** `regenerateProject` carries `client_id`, `wp_connection_id`, `wp_page_ids` forward
- [ ] **4b.** **A test asserting client B gets 403 for client A's `projectId`.** The isolation
      check at `portal/requests/route.ts:47` is correct by inspection but has *never
      executed*, because `client_id` is always NULL — it becomes load-bearing for the first
      time at step 5. Write the test before, not after
- [ ] **5.** *Only now:* `PATCH /api/projects/[id]/client` + project-page picker

**Demo:** file two consecutive change requests on one project; both apply, neither reverts
the other, the portal keeps showing the right site, and a forced mid-apply failure produces
an honest error rather than a completion email.

---

## Phase 1 — The Section Registry · *the quality rebuild*

The core architectural change. See [`NORTH-STAR.md §5`](./docs/NORTH-STAR.md) and
capability 1 in [`PRODUCT-VISION.md`](./docs/PRODUCT-VISION.md).

**The decision this phase makes:** the model emits `{section_id, variant, slot_values}` plus
a token document — **never markup**. That is what makes a sanitizer unnecessary rather than
merely absent, and it is the destination for the entire HTML-validation debt.

- [ ] `SiteModel`, `Brand`, `DesignTokens`, `Page`, `Section`, `MediaRef` types
- [ ] Section registry, versioned: `hero`, `services`, `about`, `features`, `testimonials`,
      `gallery`, `faq`, `cta`, `contact` — 2 variants each, responsive and WCAG 2.2 AA by
      construction (24px targets, no drag-only interactions, focus never obscured,
      consistent help affordance — all enforced at token level)
- [ ] Stable `(section_id, variant, registry_version)` instance ids emitted into rendered
      output — **required now**, because capability 3 cannot be retrofitted
- [ ] `renderHtml(model)` → generated `theme.json` + one real stylesheet, not inline
      `<style>` per page
- [ ] `plan(brief)` → `SitePlan` via one JSON-schema LLM call
- [ ] `write(plan, brief)` → slot values via small parallel JSON-schema calls, shape-asserted
      before persist (`finish_reason === 'stop'`, no refusal, non-empty)
- [ ] `validate(model)` → the [§4 quality gates](./docs/NORTH-STAR.md), blocking
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
