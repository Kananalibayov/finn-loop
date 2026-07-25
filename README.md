# Finn-Loop on ZCode

A 3-skill AI software factory adapted from
[Alex Finn's "Prompting is dead" video](https://youtu.be/FRGLToHAtgc)
(repo: [finna/Finn-loop](https://github.com/finna/Finn-loop)),
running on **ZCode** with **GitHub Issues** instead of Linear, and **ZCode cron**
instead of Claude Code's `/loop`.

You spend ~15 min in the morning giving ideas. AI builds + reviews all day while
ZCode is open. You click merge at night.

```
You (idea) → /finn-spec → GitHub Issue → you label it agent-ready
                                                ↓
finn-build picks it up → codes it → opens PR → finn-review tests → verdict
                                                ↓
                                loop-approved ✅ → you merge
```

---

## What's in this folder

```
ZCodeProject/
├── README.md                          ← you are here
├── AGENTS.md                          ← the rules the AI follows
└── .zcode/
    └── skills/
        ├── finn-spec/SKILL.md         ← the interviewer
        ├── finn-build/SKILL.md        ← the builder
        └── finn-review/SKILL.md       ← the reviewer
```

---

## Setup status (already done)

- ✅ GitHub CLI (`gh`) installed at `C:\Program Files\GitHub CLI\gh.exe`
- ✅ Logged in as `Kananalibayov`
- ✅ Repo created: `Kananalibayov/finn-loop` (private)
- ✅ All 7 labels created
- ✅ Cron automation "Finn-loop builder (every 5 min)" registered
- ⬜ Cron automation "Finn-loop reviewer (every 5 min)" — see below

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

## How to register the reviewer cron

The builder cron is already registered in this session. ZCode does not allow a
scheduled task to create another scheduled task from within itself, so register
the reviewer cron yourself:

1. **Open a NEW ZCode session** (not this one).
2. Type (or say):
   > Schedule an automation titled "Finn-loop reviewer (every 5 min)" that runs
   > every 5 minutes. Prompt: "Run the /finn-review skill now. Work from the
   > repo at C:\Users\newke\ZCodeProject. Review exactly one PR that needs
   > review, post the three-group verdict comment, and set labels. Never merge,
   > never push, never use a formal GitHub review. Report briefly what you did
   > or if nothing needed review."
3. ZCode will create the automation and confirm.

To list or delete automations, in any session say *"list my automations"* or
*"delete the Finn-loop builder automation"*.

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

### All day (AI, while ZCode is open): The cron loops run
- The builder cron claims `agent-ready` issues and opens PRs.
- The reviewer cron reviews PRs and labels them `loop-approved` or
  `loop-changes-requested`.

You can watch it work in your repo:
```bash
gh issue list                       # see the queue
gh pr list                          # see open PRs
gh pr list --label loop-approved    # see what's ready to merge
```

### Night (~5 min): Merge
Merge anything labeled `loop-approved` that you're happy with:
```bash
gh pr merge <PR-NUMBER> --squash --delete-branch
```

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

### `/finn-build` — The Builder (runs on cron)
Each run does **exactly one unit of work**:
1. **Preflight**: confirms clean working tree (never stashes/resets your work)
2. First checks for PRs with `loop-changes-requested` and fixes them
3. Otherwise claims the oldest `agent-ready` + unassigned + not-blocked issue
4. Creates a branch `NN-short-name`
5. Implements ONLY the acceptance criteria (non-goals are binding)
6. Runs lint/test/build locally — must pass
7. Opens a PR with `Closes #NN`, a scope ledger, test steps, risk level
8. Labels it `loop-review-requested`
9. **Never merges, never enables auto-merge**

### `/finn-review` — The Reviewer (runs on cron)
Each run reviews **exactly one PR**:
1. Finds the oldest PR with `loop-review-requested` (skips already-reviewed SHAs)
2. Loads the linked issue (the contract)
3. Checks mergeability + required CI checks
4. Posts a 3-group verdict: 🔴 Must fix / 🟡 Should fix / 🟢 Safe to merge
5. Labels it `loop-changes-requested`, `loop-approved`, or
   `needs-human-review`
6. **Never merges, never pushes, never uses a formal GitHub review**

---

## The labels (cheat sheet)

| Label | Color | Meaning |
|---|---|---|
| `finn-spec` | yellow | Issue filed by finn-spec |
| `agent-ready` | green | **You** approved the spec — ready to build |
| `blocked` | red | Builder hit a wall, needs your decision |
| `loop-review-requested` | blue | PR waiting for review |
| `loop-changes-requested` | orange | Reviewer found must-fix issues |
| `loop-approved` | green | Reviewer verified — ready for your merge |
| `needs-human-review` | purple | Reviewer escalated (ambiguous / no CI) |

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
the "Verify" step in `.zcode/skills/finn-build/SKILL.md` to match.

---

## Credits

Adapted from Alex Finn's
["Prompting is dead" video](https://youtu.be/FRGLToHAtgc) and his
[Finn-loop repo](https://github.com/finna/Finn-loop). The architecture and the
three skill designs are his; this is a faithful ZCode + GitHub Issues port.
