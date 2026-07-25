---
name: finn-build
description: Claim the next safe agent-ready issue from GitHub Issues, implement it, and open a PR. Use when asked to run Finn-loop's builder, work the approved queue, or fix Finn-loop review feedback. Designed for the cron loop; one pass does one unit of work.
---

# Finn-loop builder

One pass = one unit of work: fix review feedback on one existing PR, or build
one issue end to end. Under the cron loop, each iteration runs this skill once.

## 0. Preflight

Before changing GitHub, branches, or files:

- Confirm this is the intended GitHub repository and `origin` is reachable.
- Detect the repository's default branch with
  `gh repo view --json defaultBranchRef --jq .defaultBranchRef.name`; never
  assume it is `main`.
- Require a clean working tree (`git status --porcelain` must be empty). If it
  is dirty, report the paths and end the pass. Never stash, reset, overwrite,
  or commit unrelated work.

## 0a. Auto-merge gate (user-authorized)

The user has authorized auto-merge to enable unattended progression. BEFORE
claiming new work, check for any PR that is ready to merge:

```bash
gh pr list --state open --label loop-approved \
  --json number,mergeable,labels --jq '.[] | {number, mergeable, labels: [.labels[].name]}'
```

For each candidate, merge it ONLY if ALL are true:
1. Labeled `loop-approved`
2. `mergeable` == "MERGEABLE"
3. NOT labeled `needs-human-review`
4. The required `build` CI check passed:
   ```bash
   gh pr checks <NUMBER> --required --json bucket,name,state
   ```
   (every required check must have `state` == "SUCCESS")

If conditions hold, merge:
```bash
gh pr merge <NUMBER> --squash --delete-branch
```
Then sync local main so the next issue builds on merged code:
```bash
git checkout main && git pull && git checkout -
```
A merge counts as the unit of work for this pass — end the pass after merging.

## 1. Review feedback first

List open PRs labeled `loop-changes-requested`, including their labels:

```bash
gh pr list --state open --label loop-changes-requested \
  --json number,title,headRefName,headRefOid,labels,updatedAt,url
```

Skip every PR carrying `needs-human-review`; it has left the automated repair
queue until a human resolves the escalation.

If any PR remains, choose the least recently updated one. Read its linked
issue (the `Closes #NN` in the PR body) and latest `Finn-loop review of
COMMIT_SHA` verdict. Check out its branch, fix only the "Must fix before
merge" items, run the relevant checks, push, remove
`loop-changes-requested`, and comment with what changed. End this pass.

If a proposed fix would cross an issue non-goal or requires a product
decision, do not implement it. Comment the exact conflict, add
`needs-human-review`, remove `loop-changes-requested`, and end the pass.
This prevents the next loop iteration from retrying a decision only a human
can make.

## 2. Pick

List GitHub issues that meet every condition:

```bash
gh issue list --state open --label agent-ready \
  --search "no:assignee -label:blocked" --json number,title,assignees,labels
```

Filter for issues that:
- are labeled `agent-ready`
- have no assignee (unclaimed)
- are NOT labeled `blocked`

Sort by oldest issue number first. If the queue is empty, say so and end the
pass. Do not invent work and do not pick a blocked issue.

## 3. Claim (the cooperative lock)

Assign the issue to yourself so no other agent grabs it:

```bash
gh issue edit <NUMBER> --add-assignee "@me"
```

Claim before reading deeply or writing code. Re-fetch the issue immediately
after the update; if it is blocked, assigned to somebody else, or no longer
`agent-ready`, do not work it and return to step 2.

The assignee prevents different people from taking the same issue. Because a
single GitHub user account is used, only one builder loop may run per
repository.

## 4. Read

Fetch the full issue including comments:

```bash
gh issue view <NUMBER> --comments
```

Implement only its acceptance criteria. Non-goals are binding. Compare every
`AC-N` against every `NG-N` before editing. No unrelated changes and no
opportunistic refactors.

If an acceptance criterion is ambiguous, conflicts with a non-goal, or
depends on an unresolved blocker, go to step 8. Never guess.

## 5. Build

- Fetch the latest default branch from `origin` and create or resume a branch
  named `<NUMBER>-short-slug`, using the issue's real number
  (e.g. `42-dark-mode`).
- Implement the acceptance criteria using the repository's existing style,
  architecture, and naming.
- Add or update tests when the change affects logic, data flow, permissions,
  integrations, or user-visible behavior.
- Preserve behavior outside the issue contract.

```bash
git checkout <DEFAULT-BRANCH> && git pull
git checkout -b <NUMBER>-<short-slug>
```

## 6. Verify

Run the project's relevant lint, typecheck, build, and narrowest useful
tests. All checks attributable to this change must pass before opening a PR.
If a broad check has a pre-existing unrelated failure, run the relevant
targeted check, preserve the evidence, and disclose both results in the PR.

Review `git diff` and `git status` before shipping. Stop if the diff contains
unrelated work or generated secrets.

## 7. Ship

Push and open a PR with `gh pr create`. Its description must include:

- What changed and why
- `Closes #<NUMBER>`, using the real issue number
- A scope ledger: one evidence line per `AC-N`, one preservation line per
  `NG-N`, and `Other behavior changes: None`
- Numbered manual test steps matching what was actually built
- Automated checks run and their results
- Risk: Low / Medium / High

```bash
git add -A
git commit -m "<message> (closes #<NUMBER>)"
git push -u origin <branch-name>
gh pr create --title "<title>" --body "<scope ledger + test steps + risk>" --base <DEFAULT-BRANCH>
```

If `Other behavior changes: None` is not true, stop and get the issue amended
before opening the PR.

Comment the PR URL on the issue:

```bash
gh issue comment <NUMBER> --body "PR opened: <PR-URL>"
gh pr edit <PR-NUMBER> --add-label "loop-review-requested"
```

Never merge and never enable auto-merge. End the pass.

## 8. Blocked

Comment one specific question a human can answer asynchronously, apply the
`blocked` label, and unassign yourself:

```bash
gh issue comment <NUMBER> --body "<one specific question with options and which AC it affects>"
gh issue edit <NUMBER> --add-label "blocked" --remove-assignee "@me"
```

Leave `agent-ready` in place: the pick query explicitly excludes `blocked`,
so the issue safely reappears only after a human answers and removes that
label.

Never use "this is unclear" as the question. State the exact decision, the
available options, and which acceptance criterion it affects. End the pass so
the next iteration can pick different work.
