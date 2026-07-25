# Project: Finn-Loop on ZCode

This project runs the **Finn-loop** — a 3-skill AI software factory adapted from Alex Finn's setup, running on ZCode with GitHub Issues instead of Linear.

## The three skills

| Skill | Role | When it runs |
|---|---|---|
| `/finn-spec` | Interviews you, writes a bulletproof spec, files a GitHub Issue | When you have a new idea |
| `/finn-build` | Claims an approved issue, implements it, opens a PR | On the build loop |
| `/finn-review` | Reviews a finished PR against its spec, posts a verdict | On the review loop |

## The loop in one picture

```
You (idea) → /finn-spec → GitHub Issue → you label it agent-ready
                                                ↓
/finn-build picks it up → codes → opens PR → /finn-review tests → verdict
                                                ↓
                                loop-approved ✅ → you merge
```

## The six rules (read these)

1. **If it's not in the GitHub issue, it doesn't exist.** No side-channel chat instructions to builders.
2. **One issue = one PR.** Size issues to ≤ 1 day of agent work.
3. **Acceptance Criteria are observable; Non-Goals are binding.** A PR can't expand scope.
4. **Blocked / needs-human-review issues leave the queue** until a human resolves them.
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

## Setup checklist (one-time)

See `README.md` for the full setup walkthrough.

## Working conventions

- Branch naming: `<ISSUE-NUMBER>-<short-slug>` (e.g. `42-dark-mode`)
- PR body must include `Closes #NN` so GitHub links the issue.
- Always verify lint/test/build locally before opening a PR.
- Never enable auto-merge. Never let an agent merge.
