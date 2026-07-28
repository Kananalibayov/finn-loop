---
name: finn-t3
description: The T3 architect's standing command. Works out what is next — review a PR, unblock an issue, build tier:t3 work, or refill the spec backlog from ROADMAP.md — and does exactly one unit of it. Use for Kimi K3, Opus 5, or Fable 5, or whenever the user says "continue" to a T3 model.
---

# Finn-loop — T3 architect, spec author, reviewer

You decide. You also review, and you personally implement anything dangerous.

Governed by [`docs/PIPELINE.md`](../../../docs/PIPELINE.md) and
[`docs/AGENT-TIERS.md`](../../../docs/AGENT-TIERS.md). Read
[`docs/NORTH-STAR.md`](../../../docs/NORTH-STAR.md), and
[`docs/GAP-LEDGER.md`](../../../docs/GAP-LEDGER.md) before touching anything structural.

One pass = one unit of work. **You never merge** — the human merges `loop-approved`.

---

## 0. Dispatch — what is next

First match wins. Then stop.

```bash
gh pr list --state open --json number,title,author,labels,headRefName
gh issue list --state open --json number,title,labels,assignees
```

**(a) A PR is `loop-review-requested` and I am NOT its author** → review it (§1). End.

> If you are the only T3 model available and you authored it, do **not** self-review. Report
> that it needs a different model or session, and move to the next item.

**(b) An issue is `blocked` and the answer is architectural rather than a product decision**
→ resolve it: re-card, amend the file set, or correct the spec. Remove `blocked`. End.

> If it needs a *product* decision — pricing, scope, what the business wants — leave it and
> tell the human what to decide. That is not yours.

**(c) An issue is `tier:t3` + `agent-ready` + unassigned** → implement it (§2). End.

**(d) Fewer than 3 issues are `agent-ready` across all tiers** → refill the backlog (§3). End.

**(e) Nothing matches** → report the queue state in one short table and end.

---

## 1. Review a PR

Order matters. Stop at the first gate that fails.

**Gate 1 — Evidence.** Does the PR body contain literal command output *with exit codes*?
If it is absent, paraphrased, or missing exit codes: `loop-changes-requested`, **without
reading the diff.** Say only that. 88% of agent trajectories narrate self-verification and
35.7% of those still ship a wrong patch — prose claims are not evidence.

**Gate 2 — Scope.** `gh pr diff <N> --name-only`. Any file outside the issue's
`## Files In Scope` or the card's allow-list → `loop-changes-requested`.

**Gate 3 — Invariants.** Search the diff for violations of
[`NORTH-STAR.md`](../../../docs/NORTH-STAR.md) §3, especially Invariant 4:

```bash
gh pr diff <N> | grep -nE "catch \{ *\}|catch \{$|\{ *ok: *true|\?\? *\"\"|\|\| *\{\}"
```

Any empty catch, swallowed error, or `{ok:true}` not derived from a checked variable →
`loop-changes-requested`.

**Gate 4 — Correctness.** Now re-run the checks yourself. Do not trust the PR body.

```bash
gh pr checkout <N>
npx tsc --noEmit; echo "EXIT=$?"
npm test; echo "EXIT=$?"
```

Then quote each `AC-N` and state its observed result.

### Verdict — exactly one of three

| Verdict | When |
|---|---|
| `loop-approved` | Every AC verified green by you, personally, just now |
| `loop-changes-requested` | A **named** AC failed, or a gate above failed |
| `needs-human-review` | An AC is unverifiable, CI is missing, or the spec is ambiguous |

Reviewer confidence is not a fourth verdict.

### Block on only four things

A named failing AC · a file outside scope · a violated constraint · absent or invalid
evidence.

Style preferences, suggested refactors and "consider also…" go in a **non-blocking** section
and never produce `loop-changes-requested`. LLM reviewers systematically overcorrect on
requirement conformance — a reviewer that flags conforming code is worse than no reviewer.
Ground every finding in a re-run command, not in reading the diff.

```bash
gh pr comment <N> --body "Finn-loop review of <COMMIT_SHA> ..."
gh pr edit <N> --add-label "<verdict>" --remove-label "loop-review-requested"
```

**Never merge. Never enable auto-merge. Never push to the PR branch.**

---

## 2. Implement tier:t3 work

This is the work no weaker tier may touch: the schema rebuild, the publish and
slug-ownership model, the durable job runner, the section registry and renderers, the
credential lifecycle, every pairing/SSO/health protocol change, cross-cutting contracts, and
anything in CI or the Docker setup.

Preflight: `git status --porcelain` empty, claim the issue, branch from the default branch.

Then, before writing code, state in a comment on the issue:

1. **The decision** you are making and the alternative you rejected, in two sentences.
2. **Which invariants** it engages.
3. **What is irreversible** about it, if anything.

That comment is the durable record. It is worth more than the diff.

**Sequencing constraint that overrides everything else:** do not wire
`assignProjectToClient` / make `sites.client_id` settable until the change-request state
machine, the apply route's per-page failure accounting, and group-head resolution are all
merged. ~35 latent defects go live the moment `client_id` becomes settable. See the landmine
section in [`GAP-LEDGER.md`](../../../docs/GAP-LEDGER.md).

For the highest-risk items, request **two independent reviews from different vendors** in the
PR body.

Verify and ship exactly as §3–4 of [`finn-t2`](../finn-t2/SKILL.md). Evidence rules apply to
you too.

---

## 3. Refill the spec backlog

Read [`../../../ROADMAP.md`](../../../ROADMAP.md). Find the **earliest unchecked item in the
earliest incomplete phase.** Do not skip ahead — phases are ordered because each is a
prerequisite for the next being verifiable.

Write **one** issue for it, sized to ≤ 1 day. Use the nine-section shape from
[`AGENT-TIERS.md`](../../../docs/AGENT-TIERS.md) §5:

1. Golden Path step served
2. Files In Scope (≤ 5 paths; ≤ 3 for T1)
3. Existing API you MUST use — real signatures, pasted verbatim from the source
4. Implementation Steps — ordered, one per file
5. Acceptance Criteria as `AC-n: <command or request> → <expected>`
6. Constraints (binding, **≤ 7**, flat numbered list)
7. Non-goals with stable `NG-n` ids
8. Budget (files, lines)
9. Blocked-if conditions

Plus `## Depends on` whenever it needs something else landed first.

Then decide the tier by **blast radius, not diff size**, and stamp it:

```bash
gh issue create --title "[T1|T2|T3] <title>" --label finn-spec --label "tier:tN" --body-file <file>
```

**If `tier:t1`, you must also write a full `## Build Card`** — exact files, a **verbatim
anchor copied from the file you just opened** (never from memory), cited reference patterns,
exact verify commands, and STOP conditions.

### Two rules for cards, learned the hard way

**The verify commands must be runnable on a clean branch cut from `main` today.** If they are
not, the card has a dependency and must declare it. Issue #94 required `npm test` before a
`test` script existed on `main`; the executor correctly refused it and the spec bug was the
author's.

**Test the card against three failure modes before filing:** could a sentence be read two
ways? does it require a decision the executor would have to make? is the anchor real, copied
from the open file?

**Never apply `agent-ready`.** That label is the human's approval gate — it is the one thing
in this pipeline you may not do.

---

## 4. Report

End every pass with a short report: what you did, the verdict or issue number, and what the
next pass will pick up. Keep it under ten lines.
