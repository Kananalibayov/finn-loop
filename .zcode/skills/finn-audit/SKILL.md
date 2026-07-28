---
name: finn-audit
description: Kimi's periodic checkpoint audit. Diffs main since the last recorded checkpoint, checks accumulated work against NORTH-STAR invariants and the seven GAP-LEDGER root-cause patterns, fixes what it finds, proposes backlog additions, and records the result. Run when the user says "kimi, audit" or after the audit-due nudge fires.
---

# Finn-loop — checkpoint audit

You are not reviewing one PR. You are looking at a **batch** of already-merged work — the
things `/finn-t1` and `/finn-t2` built and cross-reviewed each other on, unsupervised by a
frontier model until now. Your job is to catch what routine review couldn't: drift, gaps in
the mechanical gate itself, and defect classes CI cannot see (`docs/GAP-LEDGER.md`'s seven
patterns are all invisible to `tsc` + `npm test` + `next build` — see pattern-by-pattern
mapping in that file, §A).

One pass = one audit. Read [`docs/NORTH-STAR.md`](../../../docs/NORTH-STAR.md) and
[`docs/GAP-LEDGER.md`](../../../docs/GAP-LEDGER.md) in full before starting, even if you
have read them before — merged work since the last audit may have changed what's true.

---

## 0. Preflight

```bash
git status --porcelain
```

Must be empty. Then get onto current `main`:

```bash
git fetch --prune origin
git checkout main
git pull --ff-only
```

If `--ff-only` fails, stop and report it — do not force or merge.

---

## 1. Find the range to audit

**Do not use a git tag.** A tag is the wrong marker here: squash-merging orphans it, a
missing tag has no safe default (re-audit everything at maximum cost, or silently no-op and
report success — which is pattern 1, inside the audit itself), it is mutable with no history
so a future run could quietly move it, and three worktrees mean stale per-worktree tags.

The marker is **[`docs/AUDIT-LOG.md`](../../../docs/AUDIT-LOG.md)**, an append-only file.

```bash
cat docs/AUDIT-LOG.md
```

Read the last entry's `Base SHA` and `Head SHA`. If the file does not exist yet, this is
audit #1 — the range is the entire repo history up to current `main`.

Get everything merged since the last audit's `Head SHA`:

```bash
git log --oneline <LAST_HEAD_SHA>..HEAD
gh pr list --state merged --base main --search "merged:>=<LAST_AUDIT_DATE>" \
  --json number,title,mergedAt,author
```

Use the GitHub API for the human-readable list (PR numbers, titles, who/what built them) and
`git log`/`git diff` for the actual content. Do not count merges by git log alone — a
squash-merged PR is one commit regardless of how much it changed, and the PR list is what
tells you scope.

If there is nothing new since the last audit, say so, append a no-op entry to
`docs/AUDIT-LOG.md` (see §5 — a no-op is still a recorded entry, never a silent skip), and
end the pass.

---

## 2. Check the batch against NORTH-STAR invariants

Read [`docs/NORTH-STAR.md`](../../../docs/NORTH-STAR.md) §3 (Invariants) in full. For every
merged PR in range, check specifically for:

- **Invariant 4 (never report success for work that did not happen).** Grep the diff:
  ```bash
  git diff <LAST_HEAD_SHA>..HEAD | grep -nE "catch \{ *\}|catch \{$|\{ *ok: *true|\?\? *\"\"|\|\| *\{\}"
  ```
  Any hit is a candidate — read the surrounding code before deciding it's real. This is the
  single most common failure mode; `docs/GAP-LEDGER.md` pattern 1 is the largest defect class
  in the repo's history and nothing in the mechanical gate catches new instances of it.
- **Which Golden Path step each PR claimed to serve**, and whether the diff actually serves
  it. A PR that drifted scope during a fix-up round is easy for a same-tier reviewer to miss.
- **Whether any PR touched a file outside its issue's `Files In Scope`** without that being
  called out. `finn-gate`'s scope check is diff-vs-issue at merge time; it does not re-check
  after the fact against what actually shipped.

---

## 3. Check the batch against the seven GAP-LEDGER patterns

Read [`docs/GAP-LEDGER.md`](../../../docs/GAP-LEDGER.md) patterns 1–7 (and §8, authorization)
in full. For each pattern, ask: **did anything in this batch make it worse, or fail to make
it better where it should have?**

- Pattern 1 (success as a shape) — covered above, but also check: does a new DB writer return
  `changes`? Does a new outbound call return a discriminated union with no fabricated-success
  branch?
- Pattern 2 (no boundary parsed) — any new `as` cast across a trust boundary? Any new route
  that doesn't parse its body against a schema?
- Pattern 3 (no identity/transactions) — any new multi-statement write outside
  `db().transaction()`? Any new INSERT that doesn't supply its own identifiers inline?
- Pattern 4 (inline multi-step work) — any new long-running external call with no timeout,
  no idempotency key, no cost accounting?
- Pattern 5 (secret lifecycle) — any new secret minted with `Math.random()` instead of
  `node:crypto`? Any credential created before validation instead of after?
- Pattern 6 (UI as second source of truth) — any new mutation with no error render, no
  `role="alert"`, a hand-rolled `error` `useState` instead of a shared action hook?
- Pattern 7 (artifact never exercised) — did anything change Node version, Docker base, or
  CI in a way that could desync them again?
- §8 (authorization) — run `npm test` and confirm `lib/route-auth.test.mts`'s ratchet total
  hasn't grown. If it has, that's a regression — a new route was added to
  `MIDDLEWARE_ONLY_BASELINE` instead of getting real auth, and it should not have been.

---

## 4. Check the pipeline's own state for drift

This audit exists partly because of a real incident: `ROADMAP.md`'s checklist went stale
relative to merged work, and a `/finn-t3` backlog-refill pass re-specced already-finished
work as a result (issue #114). Check for the same class of drift every time:

- Do `ROADMAP.md`'s checked boxes match what's actually merged? Cross-reference against the
  PR list from step 1.
- Are there any open issues whose `Files In Scope` or anchors no longer match current `main`
  (the same failure mode #103 hit — a card's anchor drifting out from under it between when
  it was written and when it was claimed)? Spot-check a sample; you do not need to verify
  every open issue every audit.
- Does `docs/AGENT-TIERS.md`'s tier routing still match reality — has anything shipped that
  should change a model's placement?

---

## 5. Fix what you found, propose what's missing

**You may fix defects directly** — this is `tier:t3` work, same rules as
[`finn-t3`](../finn-t3/SKILL.md) §2: state the decision and its alternative in a comment
before writing code, follow the sequencing constraint on `client_id` (§2 of that skill),
verify with real command output, ship a normal PR through the normal gate. You are not
exempt from evidence or scope discipline just because this is an audit.

**You may propose new backlog items** — file them per
[`finn-t3`](../finn-t3/SKILL.md) §3's nine-section shape, stamped with the correct tier.

**You may NOT self-apply `agent-ready`, and you may NOT edit `ROADMAP.md` directly.**
`ROADMAP.md` is a `CODEOWNERS`-protected file for exactly this reason: if roadmap lines ever
become standing approval (see `docs/PIPELINE.md` §"Roadmap as standing approval"), an auditor
that can write the roadmap can grant itself unlimited future scope. Propose roadmap changes
as a normal PR against `ROADMAP.md` — it will be **held** by `finn-gate` (protected path) for
the human to merge, same as any other change to that file.

---

## 6. Record the checkpoint

**Append to `docs/AUDIT-LOG.md` — never overwrite, never edit a previous entry.** A previous
entry is a record of what happened; correcting history here is exactly the kind of "declare
yourself done" failure mode a mutable marker would invite.

```md
## Audit N — <ISO date>

**Base SHA:** `<LAST_HEAD_SHA>` (previous audit's head, or "repo start" for audit #1)
**Head SHA:** `<current main SHA>`
**PRs in range:** #a, #b, #c (N total)

### Findings
- <one line per real finding, or "None — batch was clean">

### Fixed directly
- <PR number + one line, or "None">

### Filed for later
- <issue number + one line, or "None">

### Pipeline drift
- <ROADMAP/anchor/tier-routing drift found and corrected, or "None">
```

Commit this file on its own branch (it's `docs/`, so it will be **held**, not blocked, by
`finn-gate` — you can still open the PR, it just needs your merge). If you also shipped fixes
in step 5, the audit-log entry can ride in the same PR as the last fix, or its own — your
call, but do not leave it unrecorded.

---

## 7. Report

End with a short summary: PRs covered, findings count, what got fixed vs. filed, and the new
checkpoint. Under 15 lines. The full detail lives in `docs/AUDIT-LOG.md` — this is a pointer
to it, not a duplicate of it.
