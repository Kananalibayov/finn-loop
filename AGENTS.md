# Project: Finn-Loop on ZCode

This project runs the **Finn-loop** — a 3-skill AI software factory adapted from
[Alex Finn's loop](https://youtu.be/FRGLToHAtgc) (repo: [finna/Finn-loop](https://github.com/finna/Finn-loop)),
running on **ZCode** with **GitHub Issues** instead of Linear.

## ⚠️ Read the product north star first

This file describes **how we build**. It does not describe **what we are building**.

## Your standing command

You do not need to be told what to work on. Run the one command for your tier and it works
out what is next from the GitHub queue:

| You are | Run | Model |
|---|---|---|
| T1 executor | `/finn-t1` | GLM 5.2 |
| T2 implementer | `/finn-t2` | Sonnet 5 |
| T3 architect / reviewer | `/finn-t3` | Kimi K3, Opus 5, Fable 5 |

[`docs/PIPELINE.md`](./docs/PIPELINE.md) is the full dispatch order and label state machine.

Before specifying or implementing anything, read — in this order:

1. **[`docs/NORTH-STAR.md`](./docs/NORTH-STAR.md)** — what the product is, the Golden
   Path every feature must serve, the invariants, and the quality bar. **Authoritative.**
   If a request conflicts with an invariant there, say so before building and name it.
2. **[`docs/AGENT-TIERS.md`](./docs/AGENT-TIERS.md)** — **which model may do which work.**
   If you are a GLM-class builder, this file governs you: you work only from a Build Card,
   and an uncarded issue is a stop condition.
3. **[`docs/GAP-LEDGER.md`](./docs/GAP-LEDGER.md)** — 162 verified defects and the seven
   root causes. Read the **sequencing landmine** section before touching `client_id`.
4. **[`docs/STATE-OF-THE-BUILD.md`](./docs/STATE-OF-THE-BUILD.md)** — where the code
   honestly is, including what is broken while appearing to work.
5. **[`docs/PRODUCT-VISION.md`](./docs/PRODUCT-VISION.md)** — the defensible position and
   the enterprise/compliance requirements that gate publishing.
6. **[`ROADMAP.md`](./ROADMAP.md)** — the ordered phases. Do not start a phase before the
   one above it is done.

Every issue and PR must state **which Golden Path step it serves**. Work that serves no
step, and was not explicitly requested, is out of scope.

**The two rules that override convenience:**
- **Never report success for work that did not happen.** Seven shipped features currently
  violate this. It is Invariant 4 and the root cause of the largest defect class in the repo.
- **Never claim a check you did not run.** Evidence means literal command output with exit
  codes, or the word `NOT RUN`.

## The four skills

| Skill | Role | When it runs |
|---|---|---|
| `/finn-spec` | Interviews you, writes a spec, files a GitHub Issue | When you have a new idea (you must be present) |
| `/finn-t1` | Executes a Build Card exactly. No design decisions | T1 cron (GLM 5.2) |
| `/finn-t2` | Implements a spec inside a named file set | T2 cron (Sonnet 5) |
| `/finn-t3` | Reviews PRs, unblocks, builds `tier:t3`, refills the backlog | T3 cron (Kimi K3 / Opus 5) |

Review is dispatch step (a) of `/finn-t3` — there is **no separate reviewer skill or cron**.

## The loop in one picture

```
ROADMAP.md → /finn-t3 specs it → GitHub Issue → YOU label it agent-ready
                                                      ↓
                            /finn-t1 or /finn-t2 builds it → opens PR
                                                      ↓
                        /finn-t3 reviews it (different model than built it)
                                                      ↓
                          loop-approved → finn-gate check → GitHub auto-merges
```

## The six rules (read these)

1. **If it's not in the GitHub issue, it doesn't exist.** No side-channel chat
   instructions to builders.
2. **One issue = one PR.** Size issues to ≤ 1 day of agent work.
3. **Acceptance Criteria are observable; Non-Goals are binding.** A PR can't
   expand scope.
4. **Blocked / needs-human-review issues leave the queue** until a human
   resolves them.
5. **Spec quality is the bottleneck.** Vague specs = confidently-wrong PRs.
6. **No agent ever merges.** Merging is done by GitHub, gated on the `finn-gate` required
   check. `loop-approved` is *evidence*, not an instruction to merge. See "Merge policy".

## Label glossary

| Label | Meaning | Who sets it |
|---|---|---|
| `finn-spec` | Issue filed by finn-spec | finn-spec |
| `agent-ready` | Spec approved, ready to build | **human** (the approval gate) |
| `tier:t1` / `tier:t2` / `tier:t3` | Which model owns it | `/finn-t3` |
| `blocked` | Builder needs a human or architectural decision | any builder |
| `loop-review-requested` | PR waiting for review | the builder that opened it |
| `loop-changes-requested` | Reviewer found must-fix items | `/finn-t3` |
| `loop-approved` | Reviewed clean — *evidence*, not a merge instruction | `/finn-t3` |
| `needs-human-review` | Escalated (ambiguous / no CI); leaves the queue | `/finn-t3` |
| `would-auto-merge` | Dry run: the gate would have merged this | `finn-gate` workflow |

## Automation

Three ZCode cron automations, one per tier, **each in its own git worktree** — see
[`docs/PIPELINE.md`](./docs/PIPELINE.md) §6. There is no reviewer automation; `/finn-t3`
covers review.

ZCode cron only runs while ZCode is open. It is "autonomous while you work", not 24/7. The
only part of this system that runs unattended is `finn-gate` + GitHub auto-merge, because
GitHub Actions is independent of the desktop app.

## Hard limits enforced by the skills

- Agents never push to the main branch directly.
- The reviewer uses a comment + labels, never a formal GitHub review (because
  GitHub rejects self-reviews on the PR author's token).
- Missing CI is treated as "needs-human-review", never as green.
- No agent runs `gh pr merge`. Ever. `grep -rn "gh pr merge" .zcode/` must return nothing.

## Merge policy

**GitHub merges. No LLM merges.** This is the resolution of a contradiction that used to
live in this file — one section said agents never merge while another authorised them to.

How it works:

1. `/finn-t3` reviews a PR and, if clean, applies `loop-approved` plus a comment whose first
   line is exactly `Finn-loop review of <40-char SHA>`.
2. `.github/workflows/finn-gate.yml` — a **required status check**, not a model — passes only
   when *all* of these hold:
   - `loop-approved` present and `needs-human-review` absent
   - the reviewed SHA equals the current head SHA
   - the diff touches no protected path and adds no dangerous content pattern
   - the linked issue is not `tier:t3`
3. When the gate passes, that workflow enables **GitHub's native auto-merge**. GitHub itself
   performs the merge once every required check is green. No agent is involved.

**Why this is safe:** GitHub does not strip labels when new commits land. Pushing any commit
re-runs `finn-gate`, the reviewed SHA no longer matches head, the check goes red, and GitHub
withholds the merge automatically. The race closes itself.

**Kill switch:** the repository variable `FINN_AUTOMERGE`. Anything other than `on` means
dry-run — the gate still reports pass/fail and comments what it *would* merge, but nothing
merges. Default is off.

**Never auto-merges, by design:** `tier:t3` work, and anything touching `lib/auth.ts`,
`middleware.ts`, `lib/db.ts`, `lib/plesk.ts`, `lib/wp.ts`, `lib/net.ts`, `.github/**`,
`.zcode/skills/**`, or the build/dependency surface. `.github/CODEOWNERS` additionally
requires owner review on those paths — a GitHub-native backstop that survives a bug in our
own workflow.

## Working conventions

- Branch naming: `<ISSUE-NUMBER>-<short-slug>` (e.g. `42-dark-mode`)
- PR body must include `Closes #NN` so GitHub links the issue.
- Always verify typecheck/test/build locally before opening a PR, and paste the literal
  output with exit codes.
- Never run `gh pr merge`. Never apply `agent-ready` — that label is the human's only gate.
