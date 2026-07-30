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
