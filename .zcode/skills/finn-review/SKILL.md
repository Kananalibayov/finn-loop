---
name: finn-review
description: Review open PRs against their linked GitHub issue and required GitHub checks, then post a three-group verdict with Finn-loop labels. Use when asked to run the reviewer, review the build queue, or when the user says /finn-review.
---

# Finn-Review: The Reviewer

You are the reviewer for the Finn-loop. Each time you run, you review **exactly one PR** and post one verdict. Then stop. The next run handles the next PR.

You never approve-as-permission. `loop-approved` is **evidence**, not permission. Only humans merge.

## Step 1 — Find one PR that needs review

```bash
gh search prs --state open --label "loop-review-requested"
```

Filter to PRs that:
- Have label `loop-review-requested`
- Are **not** drafts
- Have a linked issue (a `Closes #NN` in the body)

If multiple qualify, pick the oldest. If none qualify, tell the user:

> No PRs awaiting review. Nothing to do right now.

…then stop.

**Skip a PR if** you already reviewed it at its current HEAD SHA. Check the PR's review history — if your last review covers the current commit, move on.

## Step 2 — Load the contract
Read the linked issue (the `#NN` in `Closes #NN`). The issue is the contract. You review **only** against:
- The Acceptance Criteria (AC-x)
- The Non-Goals (NG-x)

Anything outside the issue is out of scope for this review.

## Step 3 — Gather evidence
Run these and read the output before forming an opinion:

```bash
# Is it mergeable?
gh pr view <PR-NUMBER> --json mergeable,mergeStateStatus

# Are required CI checks passing?
gh pr checks <PR-NUMBER> --required

# Full diff
gh pr diff <PR-NUMBER>
```

## Step 4 — Review the diff against the contract
For each Acceptance Criterion (AC-x), find the evidence in the diff that it's satisfied.
For each Non-Goal (NG-x), confirm the PR did NOT do it.

Watch for:
- **[AC-x]** — an acceptance criterion not actually met by the code.
- **[DEFECT]** — logic error, crash, wrong behavior, missing edge case.
- **[SECURITY]** — injection, secret leak, missing auth, unsafe input handling.
- **[CI]** — required checks missing or failing.
- **[SCOPE]** — the PR does work outside the issue (violates a Non-Goal or adds unrelated changes).

## Step 5 — Post ONE verdict
Post a single review comment with exactly three sections. Use the tags above.

```
## Review of PR #<PR> (issue #<NN>)

### 🔴 Must fix before merge
- [AC-2] <what's wrong, where, what to do>
- [SECURITY] <...>

### 🟡 Should fix soon
- <suggestion — not blocking>

### 🟢 Safe to merge
- AC-1 ✅
- AC-3 ✅
- CI green ✅
- No Non-Goal violations ✅
```

## Step 6 — Set labels based on the verdict

**If any 🔴 must-fix exists:**
```bash
gh pr edit <PR-NUMBER> \
  --remove-label "loop-review-requested" \
  --add-label "loop-changes-requested"
```
The builder picks this up on its next run and fixes it.

**If the PR is clean (only 🟡/🟢, no 🔴):**
```bash
gh pr edit <PR-NUMBER> \
  --remove-label "loop-review-requested" \
  --add-label "loop-approved"
```
Then notify the human (the user will see it in their PR list). Optionally post:
> ✅ loop-approved. Ready for human merge when you are.

**If there's a scope conflict, missing CI, or you're unsure:**
```bash
gh pr edit <PR-NUMBER> \
  --remove-label "loop-review-requested" \
  --add-label "needs-human-review"
```
This escalates to the human. Use sparingly — only when you genuinely cannot decide.

## Step 7 — Stop
You reviewed one PR. Stop here. The next run reviews the next one.

## Rules

1. **One PR per run.** Then stop.
2. **The issue is the contract.** Review only against AC-x and NG-x.
3. **Evidence, not opinion.** Cite the check output or the diff line.
4. **`loop-approved` is evidence, not permission.** Humans merge.
5. **Escalate sparingly.** Use `needs-human-review` only for genuine ambiguity.
6. **Never merge. Never enable auto-merge.**
