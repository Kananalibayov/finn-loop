# Finn-Loop on ZCode

An AI software factory running on **ZCode**, originally adapted from
[Alex Finn's "Prompting is dead" video](https://youtu.be/FRGLToHAtgc)
(repo: [finna/Finn-loop](https://github.com/finna/Finn-loop)).

## Current mode: one model, minimal process *(2026-07-30)*

```
You (direction, occasionally) → ROADMAP.md
                                     ↓
        one model reads it, decides what is next, builds, opens a PR
                                     ↓
              CI must be green ──→ it merges its own work
                                     ↓
        except Tier A paths ──→ held for you to merge by hand
```

**Why this shape.** The project previously ran four models reviewing each other, coordinated
through GitHub Issues, labels, claims and approval gates. That machinery existed to make *weak*
models safe and to stop two builders colliding. Running one strong model with merge authority
made all of it pure overhead — and worse, it was where nearly every stall came from: abandoned
claims hiding work, issues left open after delivery, tier filters starving the queue, review
labels blocking their own approvals. Roughly 680 lines of coordination workflow removed the
failure modes along with the ceremony.

**What is deliberately kept, and why each one is load-bearing:**

| Kept | Why it cannot go |
|---|---|
| Git history | The only undo. One model now makes design calls with nobody reviewing; when one is wrong you need to go back. |
| `ci.yml` (typecheck, tests, lint) | The only remaining check that cannot be talked past. Without it, "reports success while doing nothing" returns — the defect class that cost this project its first generator. |
| `docker-smoke.yml` | Proves the shipped artifact actually boots and works, not just that the source compiles. |
| `revert-red-main.yml` | A broken `main` becomes self-limiting instead of a silent outage nobody notices for hours. |
| `finn-gate.yml` (slimmed) | Holds Tier A paths for a human, so a self-merging model cannot quietly weaken its own gate, CI, or operating rules. |
| `backup-restore.yml` | Proves the backup is restorable. Nightly, cheap. |

**Dormant, not deleted** — `label-guard`, `roadmap-approve`, `release-stale-claims`,
`close-delivered-issues`, `audit-nudge`. Each is switched to manual-trigger-only with a comment
explaining what it did and when to switch it back. **Restore them when the project goes live**
and more than one model works the repo again; several fixed real outages and would be needed
again the moment issues and labels return.

The sections below describing the issue → `agent-ready` → tier-claim → review flow are **the
dormant process**, retained as the record of how to switch back on.

---

## What's in this folder

```
ZCodeProject/
├── README.md                          ← you are here
├── AGENTS.md                          ← the rules every model follows
├── ROADMAP.md                         ← the ordered phases
├── docs/
│   ├── NORTH-STAR.md                  ← what we're building; the invariants
│   ├── PIPELINE.md                    ← how work flows; the standing commands
│   ├── AGENT-TIERS.md                 ← which model does which work
│   ├── GAP-LEDGER.md                  ← 162 verified defects, 7 root causes
│   ├── STATE-OF-THE-BUILD.md          ← where the code honestly is
│   └── PRODUCT-VISION.md              ← positioning + compliance gates
└── .zcode/
    └── skills/
        ├── finn-spec/SKILL.md         ← the interviewer (you must be present)
        ├── finn-t1/SKILL.md           ← executor: runs a Build Card exactly
        ├── finn-t2/SKILL.md           ← implementer: bounded module work
        └── finn-t3/SKILL.md           ← architect + reviewer + backlog refill
```

---

## Setup status

- ✅ GitHub CLI (`gh`) installed at `C:\Program Files\GitHub CLI\gh.exe`
- ✅ Logged in as `Kananalibayov`
- ✅ Repo created: `Kananalibayov/finn-loop` (private)
- ✅ Labels created, including `tier:t1` / `tier:t2` / `tier:t3`
- ✅ `.github/workflows/finn-gate.yml` — the mechanical merge gate
- ✅ `.github/CODEOWNERS` — owner review required on Tier A protected paths only (see
      [`docs/PIPELINE.md`](./docs/PIPELINE.md) §4a for the Tier A/Tier B split — Tier B is
      full-automation-eligible per explicit user request)
- ⬜ Three ZCode cron automations (one per tier, each in its own worktree) — see
      [`docs/PIPELINE.md`](./docs/PIPELINE.md) §6
- ✅ Branch protection: requires `build` **and** `finn-gate`; "Allow auto-merge" enabled;
      "Require review from Code Owners" enabled (Tier A paths only)
- ✅ Repo variable `FINN_AUTOMERGE=on`

There is **no reviewer automation to register.** Review is dispatch step (a) of `/finn-t3`.

---

## ⚠️ The cron limitation you need to understand

Alex's video shows him running `/loop 5 min /him-build` in two **always-on**
Claude Code chats. ZCode's cron is different:

| | Alex's `/loop` (Claude Code) | ZCode cron |
|---|---|---|
| Runs while app closed? | ✅ Yes | ❌ No — only while ZCode is open |
| 24/7 background? | ✅ Yes | ❌ No |
| Schedule | `5 min` | `*/5 * * * *` (every 5 min) |

**So: ZCode's cron is "autonomous while you work", not "24/7 unattended".** If
you want true 24/7, that needs an external orchestrator (a script on a server,
GitHub Actions, or a small scheduled task that launches `zcode` headlessly) —
beyond built-in ZCode for now.

---

## How to register the four automations

ZCode does not allow a scheduled task to create another scheduled task, so register these
yourself. **Each needs its own git worktree** — crons against one checkout collide on the
working tree and on `data/app.db` (see [`docs/AGENT-TIERS.md`](./docs/AGENT-TIERS.md),
"Running several agents at once").

```bash
git worktree add ../finn-t1 -b wt/t1
git worktree add ../finn-t2 -b wt/t2
git worktree add ../finn-t3 -b wt/t3
git worktree add ../finn-audit -b wt/audit
```

Then, in a ZCode session, register one automation per tier — for example:

> Schedule an automation titled "Finn-loop T3 (every 5 min)" that runs every 5 minutes.
> Prompt: "Run the /finn-t3 skill now. Work from the repo at C:\Users\newke\finn-t3.
> Do exactly one unit of work per the skill's dispatch order, then stop. Never merge,
> never apply agent-ready. Report briefly what you did, or that the queue was empty."

Repeat for `/finn-t1` (dir `..\finn-t1`) and `/finn-t2` (dir `..\finn-t2`).

**Only the T3 automation may run the dev server or touch `data/app.db`.**

### The 4th automation: the audit, driven by the existing nudge

`.github/workflows/audit-nudge.yml` already computes when an audit is due (5+ merges since
the last checkpoint in [`docs/AUDIT-LOG.md`](./docs/AUDIT-LOG.md)) and keeps exactly one
"Audit due" issue open when it is. Rather than duplicate that due-ness logic in a second
place, this automation just checks for that issue and acts on it:

> Schedule an automation titled "Finn-loop audit (daily)" that runs once a day.
> Prompt: "Work from the repo at C:\Users\newke\finn-audit. Run:
> `gh issue list --state open --search 'in:title \"Audit due\"' --json number --jq 'length'`.
> If it returns 0, report that no audit is due and stop — do not run /finn-audit.
> If it returns 1 or more, run /finn-audit now. Report what it found."

A **daily** cadence is deliberate — the audit is batch work over an accumulated set of
merges, not a per-PR check, so 5-minute polling would just waste runs finding nothing new.

To list or delete automations, say *"list my automations"* in any session.

---

## How to use it (the daily flow)

### Morning (~15 min): Turn an idea into a spec
In ZCode, type:
```
/finn-spec I want a login page with email and Google OAuth
```
ZCode will:
1. Restate the idea
2. Research your codebase
3. Interview you in rounds (1–4 questions at a time, with A/B/C options)
4. Draft a spec for you to confirm
5. File a GitHub Issue

Then **you** approve it:
```bash
gh issue edit <NUMBER> --add-label agent-ready
```
*(Adding `agent-ready` is the human approval gate. The AI never adds it itself.)*

### All day (while ZCode is open): the three tier crons run
- `/finn-t1` and `/finn-t2` claim `agent-ready` issues at their tier and open PRs.
- `/finn-t3` reviews PRs it didn't author, unblocks issues, builds `tier:t3` work, and
  refills the spec backlog from `ROADMAP.md` when fewer than 3 issues are `agent-ready`.

You can watch it work:
```bash
gh issue list                          # the queue
gh pr list                             # open PRs
gh pr list --label would-auto-merge    # what the gate WOULD merge (dry run)
gh pr checks <PR> --required           # build + finn-gate status
```

### Night (~2 min): check what merged itself
Once `FINN_AUTOMERGE=on`, PRs that clear `finn-gate` are merged by GitHub without you. Your
job shrinks to three things:
```bash
gh pr list --label needs-human-review  # escalations only you can settle
gh issue list --label blocked          # questions a builder is waiting on
gh issue list --label finn-spec        # read new specs, label the good ones agent-ready
```
Anything the gate refuses — Tier A protected paths, dangerous content — you merge by
hand, deliberately. `tier:t3` alone no longer holds; most `tier:t3` work is Tier B and
auto-merges fully once reviewed.

---

## What each skill does

### `/finn-spec` — The Interviewer (interactive, you must be present)
Turns your vague idea into a bulletproof spec.
- Researches your codebase first (doesn't ask dumb questions)
- Interviews you in rounds until the confidence test passes: *"Could two
  different engineers read this spec and ship the same observable behavior?"*
- Files a GitHub Issue with `AC-1, AC-2...` (criteria) and `NG-1, NG-2...`
  (non-goals)
- **Never** adds `agent-ready` itself — that's your job

### `/finn-t1` — The Executor (GLM 5.2, runs on cron)
Applies a **Build Card** exactly. No design decisions, ever.
1. Dispatch: fix a PR of mine marked `loop-changes-requested`, else claim a `tier:t1` +
   `agent-ready` issue, else report the queue empty
2. Refuses any issue with no `## Build Card` section
3. Checks `## Depends on`, and that the card's verify commands actually exist, **before**
   editing anything
4. Confirms the card's verbatim **Anchor** text is present, or stops
5. Reads only the files the card lists — no repo exploration
6. Verifies with the card's exact commands, captured with exit codes
7. **`blocked` is a success. A guessed design decision is a failure even if the code works.**

### `/finn-t2` — The Implementer (Sonnet 5, runs on cron)
Implements a spec inside a **named file set**. Chooses *how*, not *what*.
- Stays inside `## Files In Scope`; asks rather than widening it
- May touch a route that performs an auth check when named; may **not** change how sessions
  or secrets work
- Adds tests when the change affects logic, data flow, permissions, or behaviour

### `/finn-t3` — Architect, Spec author, Reviewer (Kimi K3 / Opus 5, runs on cron)
Dispatch order — first match wins, then stops:
1. **Review** a PR it did not author → `loop-approved` / `loop-changes-requested` /
   `needs-human-review`. Evidence gate first: no literal command output with exit codes means
   rejected without reading the diff
2. Unblock an issue whose answer is architectural
3. Build `tier:t3` work — schema, publish/ownership, credentials, renderers, CI
4. Refill the backlog from `ROADMAP.md` when fewer than 3 issues are `agent-ready`

Never merges. Never applies `agent-ready`.

---

## The labels (cheat sheet)

| Label | Meaning | Who sets it |
|---|---|---|
| `finn-spec` | Issue filed by a spec pass | `/finn-t3` or `/finn-spec` |
| `tier:t1` / `tier:t2` / `tier:t3` | Which model owns it | `/finn-t3` |
| **`agent-ready`** | **Approved to build** | **You. Only ever you.** |
| `blocked` | Builder needs a decision | any builder |
| `loop-review-requested` | PR waiting for review | builder |
| `loop-changes-requested` | Reviewer found must-fix items | `/finn-t3` |
| `loop-approved` | Reviewed clean — *evidence*, not a merge instruction | `/finn-t3` |
| `needs-human-review` | Escalated; leaves the automated queue | `/finn-t3` |
| `would-auto-merge` | Dry-run: the gate would have merged this | `finn-gate` workflow |

A builder sees an issue only when it is `tier:tN` + `agent-ready` + unassigned + not
`blocked`. Any one missing and the issue is invisible to it — safe by default.

---

## Troubleshooting

**"Queue is empty or all issues are claimed/blocked"**
→ Either you haven't labeled an issue `agent-ready`, or all issues are being
  worked. File a new spec with `/finn-spec`.

**A PR is stuck oscillating between build → review → build**
→ The builder and reviewer may disagree. Read the PR comments. If they're
  stuck, add `needs-human-review` yourself and step in:
  ```bash
  gh pr edit <PR-NUMBER> --add-label needs-human-review
  ```

**`gh` commands fail with "not authenticated"**
→ Run `gh auth login` again.

**ZCode doesn't see the skills**
→ Make sure the files are at `.zcode/skills/finn-spec/SKILL.md` etc. Restart
  ZCode.

**The cron didn't fire**
→ ZCode cron only runs while ZCode is open. Keep the app open while you want
  the loop active.

**Required CI checks aren't configured**
→ The reviewer will mark PRs `needs-human-review` until you set up required
  checks in GitHub (Settings → Branches → Branch protection rules). This is
  intentional — Finn-loop never treats missing CI as green.

---

## Adapting to your project

This setup assumes a typical project with lint + test + build commands. If your
project uses different commands (e.g. `pytest`, `cargo test`, `go test`), edit
the "Verify" step in `.zcode/skills/finn-t2/SKILL.md` to match.

---

## Credits

Adapted from Alex Finn's
["Prompting is dead" video](https://youtu.be/FRGLToHAtgc) and his
[Finn-loop repo](https://github.com/finna/Finn-loop). The architecture and the
three skill designs are his; this is a faithful ZCode + GitHub Issues port.
