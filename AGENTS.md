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

## The three skills

| Skill | Role | When it runs |
|---|---|---|
| `/finn-spec` | Interviews you, writes a bulletproof spec, files a GitHub Issue | When you have a new idea (you must be present) |
| `/finn-build` | Claims an approved issue, implements it, opens a PR | On the cron loop (every 5 min) |
| `/finn-review` | Reviews a finished PR against its spec, posts a verdict | On the cron loop (every 5 min) |

## The loop in one picture

```
You (idea) → /finn-spec → GitHub Issue → you label it agent-ready
                                                ↓
finn-build picks it up → codes it → opens PR → finn-review tests → verdict
                                                ↓
                                loop-approved ✅ → you merge
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
6. **Agents NEVER merge. Humans merge.**

## Label glossary

| Label | Meaning | Who sets it |
|---|---|---|
| `finn-spec` | Issue filed by finn-spec | finn-spec |
| `agent-ready` | Spec approved, ready to build | **human** (the approval gate) |
| `blocked` | Builder needs a human decision | finn-build |
| `loop-review-requested` | PR waiting for review | finn-build |
| `loop-changes-requested` | Reviewer found must-fix issues | finn-review |
| `loop-approved` | Reviewer verified, ready for human merge | finn-review |
| `needs-human-review` | Reviewer escalated (ambiguous / no CI) | finn-review |

## Automation

A cron automation named **"Finn-loop builder (every 5 min)"** is registered in
this ZCode workspace. It runs while ZCode is open. The reviewer loop must be
registered in a separate ZCode session — see `README.md` for instructions.

## Hard limits enforced by the skills

- Agents never push to the main branch directly.
- The reviewer uses a comment + labels, never a formal GitHub review (because
  GitHub rejects self-reviews on the PR author's token).
- Missing CI is treated as "needs-human-review", never as green.

## Merge policy (user-authorized for autonomous operation)

The user has **authorized auto-merge** to enable unattended progression. When
ALL of the following are true, the next loop pass should merge the PR:

1. The PR is labeled `loop-approved` by the reviewer.
2. The required `build` CI check has passed.
3. The PR is mergeable (`gh pr view --json mergeable`).
4. The PR is not labeled `needs-human-review`.

Merge command:
```bash
gh pr merge <PR-NUMBER> --squash --delete-branch
```

After merging, immediately re-fetch `main` locally so the next issue builds on
the merged code:
```bash
git checkout main && git pull && git checkout -b <next-issue>-<slug>
```

This authorization can be revoked by the user at any time.

## Issue chain #15 → #16 → #17 → #18 (user-authorized self-activation)

The user has approved a sequential four-issue batch and authorized the builder
to advance it autonomously:

- **#15** — Docker deployment (compose + standalone + persistent volume)
- **#16** — Edit & regenerate saved sites (with version history)
- **#17** — Logo image upload (validate + resize, local storage)
- **#18** — More export formats (single HTML + static-host ZIP)

These are independent features (each touches different files), but to keep the
working tree and review queue sane the user wants them built **one at a time,
in numeric order**. To enforce that, the builder is authorized to perform ONE
normally-human action:

> When the prior issue in the chain merges (verified `CLOSED` via
> `gh issue view <N> --json state`), the next builder pass may add the
> `agent-ready` label to the next chain issue.

Procedure for the builder, run at the top of each pass after the auto-merge
gate:

1. Determine the chain head — the lowest-numbered of {15, 16, 17, 18} that is
   still OPEN and not yet merged.
2. If the chain head is already `agent-ready`: do nothing (it will be picked
   up by the normal pick step).
3. If the prior issue in the chain has just merged (verified via
   `gh issue view <N> --json state` showing `CLOSED`), add `agent-ready` to
   the chain head:
   ```bash
   gh issue edit <HEAD> --add-label "agent-ready"
   ```
4. Never add `agent-ready` to more than one chain issue at a time. Never add
   it to an issue whose prerequisite is still OPEN.

This authorization is **scoped to issues #15, #16, #17, and #18 only.** Any
other issue — including future specs the user files, and the explicitly-parked
multi-user/team-access work — still requires the human to manually add
`agent-ready`. That gate is not changed.

The user may revoke this chain authorization at any time by removing this
section or by removing `agent-ready` from the queued issue.

## Working conventions

- Branch naming: `<ISSUE-NUMBER>-<short-slug>` (e.g. `42-dark-mode`)
- PR body must include `Closes #NN` so GitHub links the issue.
- Always verify lint/test/build locally before opening a PR.
- Never enable auto-merge. Never let an agent merge.
