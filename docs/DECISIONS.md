# DECISIONS

One short entry per architectural decision: what was chosen, what was rejected, why.
Append-only — never rewrite an entry; reverse a decision with a new dated entry.

## 2026-07-30 — Consolidate conflicting registry PRs instead of sequential resolution

Four open section PRs (#199 pricing, #200 stats, #201 logos, #202 steps) each added one key
to the same `REGISTRY` literal in `lib/sections/registry.ts`. Merging any one would
re-conflict the other three. Chosen: one consolidated branch (#207) carrying all four
sections' files byte-identical to their reviewed heads plus a single hand-made registry
edit. Rejected: merging sequentially and resolving the same conflict three times (pure
churn, triple the verify cycles); and restructuring the registry into per-section
self-registration now (the section flood is over after #207 — the funnel no longer has
traffic; self-registration may still be worth doing when `css` lands in #206, decided
there).

## 2026-07-30 — `registry.test.mts` unregistered-type example updated when faq shipped

`listVariants("faq") → []` was the test's *unregistered-type* example. Registering faq
(#176/#208) expires the example. Chosen: update the assertion to pin faq's registered
variants (`["accordion","list"]`) with a comment, in the same PR that registers faq.
This is fixing the test's fixture logic, not weakening a gate: the null-path for unknown
variants is still exercised (`getRenderer("faq","split")`), and every faq AC gained its
own test (10 new cases). Rejected: leaving the suite red (unacceptable) or deleting the
assertion (loses coverage).

## 2026-07-30 — Verification runs in clean worktrees, eslint config untouched

`npm run lint` (= `eslint .`) in the working clone lints untracked scratch dirs
(`.worktrees/`, `.claude/`, `finn-loop-wp-plugin/`) and fails with ~7k errors that CI
never sees (clean checkout). Chosen: verify in a detached clean worktree per branch —
this matches CI semantics exactly — and leave `eslint.config.mjs` alone. Rejected:
adding ignore patterns to the repo's eslint config for local scratch dirs (changes the
lint surface every contributor inherits to solve a local hygiene problem).

## 2026-07-30 — CSS lives with the variant; aggregation at render time (#206)

Chosen: a required static `css` member on `SectionRenderer`, aggregated by
`collectCss(used)` in registry order into the single stylesheet beside the base
layer. Rejected: one global stylesheet (drifts from variants silently; becomes
the next `registry.ts` conflict funnel). `container-type: inline-size` is
declared per variant root rather than once on `.section` in the base layer —
AC-10 pins it in the variant's own block, and keeping the query container next
to the rules that query it makes the convention copy-proof for future variants.

## 2026-07-30 — Required `css` with 26 honest empty stubs

Making `css` required (so tsc fails when a new variant forgets it — verified:
TS2741) forced a member on all 28 variants. Hero got real CSS as the reference;
the other 26 got `css: ""`. An empty string is an honest "not styled yet", not
a fake: `collectCss` skips it, no success is reported, and per-section CSS is
the explicit next roadmap line. Rejected: optional member (kills the AC-1
compile-time guard) and filling all 26 in this PR (unreviewable bulk).

## 2026-07-30 — Base layer styles the page shell too

`BASE_CSS` gained minimal `site-header`/`site-brand`/`site-nav`/`site-footer`
rules beyond the issue's listed contents. The shell (#209) had just landed;
a styled page with an unstyled header is visibly broken, and the header is a
page-level (not section-level) concern, which is exactly the base layer's job.
Recorded here because it is a small, deliberate extension of the card.

## 2026-07-30 — `structure/links` scans `<a>` tags only; `/` is always allowed (#195)

Every rendered page carries `<link rel="stylesheet" href="/style.css">` and a
brand link `href="/"`. Reading the card's "every internal href" literally —
all `href` attributes, no root exception — would flag both on every valid page
and make AC-1 unpassable. Chosen: extract hrefs from `<a>` tags only (the
stylesheet is an asset, not navigation) and allow literal `/` plus `/<slug>`
for each rendered page. This interpretation is forced by the card's own
valid-fixture requirement, not a convenience weakening: the gate still catches
the operator-relevant defect class (a nav item or CTA pointing at a slug that
no page serves, e.g. `/nope`).

## 2026-07-30 — `sections/instance-ids`: missing ids individually, count only when none missing (#195)

A naive "check presence AND count" reports two violations for one dropped
section (its id is missing AND the total is one short), burying the actionable
fact — *which* section dropped. Chosen: report each missing expected id by
name; report a count mismatch only when all expected ids are present but the
total differs (the duplication/extra-markup case). A dropped section yields
exactly one violation naming its id; a duplicated section yields exactly one
violation giving found-vs-expected counts.

## 2026-07-30 — finn-gate: guard the empty-diff scan so docs-only PRs cannot crash the gate (#213)

A docs-only diff makes the gate's protected-path grep match nothing; an
unguarded empty scan exited non-zero and the workflow read it as a failure,
wrongly blocking documentation PRs. Chosen: an empty scan is clean; protected
paths still HOLD green and merge by hand under the mission rules. The property
that matters is unchanged — the gate decides on observable diff content, not on
the PR's self-description.

## 2026-07-30 — Failed settings loads render read-only with Retry, never empty defaults (#215, Phase 0.5 line)

Branding/Email/Plesk settings used to render editable empty forms when their
GET failed; a save then persisted empty defaults over real configuration —
silent data destruction dressed as a successful save. Chosen: on load failure
the sub-section renders read-only with a Retry control and the save path is not
mounted. A read-only failure is the honest state; a retry is cheap; persisting
empties over real config is the exact fabricated-success pattern Invariant 4
exists to forbid.

## 2026-07-30 — Section-variant CSS conventions (batches #218/#220/#222/#226, closing the #206 stubs)

The conventions every variant block now follows, machine-enforced in
`lib/sections/section-css.test.mts` for all 26 entries: the variant root
carries `container-type: inline-size`; responsive shifts use `@container` only
(never viewport `@media`); colours and metrics come from token vars only (no
hex literals; `rem` confined to breakpoints/minmax minimums; `1px`/`2px`
token-coloured borders allowed; `50%` and `aspect-ratio` count as shape values,
not metrics); every selector starts with the variant's own root class so no
block can leak into another section or the page shell. Variants whose markup
has no inner wrapper (pricing cards, cta banner, faq accordion) neutralise the
base `.section > *` margins inside their own namespace instead of touching the
base layer. Two real defects were caught by the mandatory screenshot step, not
by tests: `pricing/table` overflowed at 480px (fixed with
`table-layout: fixed`) and a price/period run-together (fixed with a margin).
Visual review remains part of the definition of done for CSS work — the gates
prove structure, the screenshots prove appearance.

## 2026-07-30 — Versioned SiteModel storage: immutable rows + a nullable head pointer (#235, Phase 0.9)

Chosen design, per the issue's delegation of details to the implementing model:

- **Table shape.** `site_model_versions(id, project_id REFERENCES sites(id) ON DELETE RESTRICT, version_number, model_json, source, created_at, UNIQUE(project_id, version_number))`. `ON DELETE RESTRICT` so a project cannot be deleted out from under its history; project deletion stays a future, explicit archival decision.
- **Nullable head pointer on `sites`.** `head_version_id` is NULL for every legacy `pages_json` project; those render exactly as today, no destructive migration, no backfill. A NULL head is the honest state "this project predates versioned storage", and the UI will say exactly that rather than fabricate a version 1.
- **`PRAGMA foreign_keys = ON` at open.** SQLite parses REFERENCES but never enforces them without this per-connection pragma. Enabling it is provably safe for legacy data: no existing table declares an FK clause, so there is nothing retroactively enforced. Proven by AC-3 (orphan insert throws).
- **Numbering inside an IMMEDIATE transaction.** `version_number = MAX(existing)+1` computed and written in one better-sqlite3 `.immediate()` transaction, so the read cannot race a concurrent writer under WAL's single-writer rule. `UNIQUE(project_id, version_number)` is the backstop if that reasoning ever breaks. Per-project numbering (not a global sequence) because operators think in "version 3 of this site", and gaps from rolled-back inserts are harmless.
- **Immutability by omission.** The accessor exposes no update or delete for version rows — supersession, not mutation, so history is the audit trail. Write path validates with `isSiteModel` before persisting; read path re-validates and throws on failure, because a row that fails on read means corrupted or hand-edited storage, and serving it downstream (render, push, diff) would be the fabricated-success pattern Invariant 4 forbids.
- **Accessor lives in `lib/db.ts`.** The module is past 1,400 lines and a `lib/db/` split by domain is due, but this PR deliberately does not mix a storage feature with a module refactor. Named as future work: split `lib/db.ts` into per-domain modules when the next storage accessor lands.
