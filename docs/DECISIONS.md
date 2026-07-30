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
