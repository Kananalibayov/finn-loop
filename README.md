# Finn-Loop on ZCode

A 3-skill AI software factory adapted from [Alex Finn's loop](https://youtu.be/FRGLToHAtgc), running on **ZCode** with **GitHub Issues** instead of Linear.

You spend ~15 min in the morning giving ideas. AI builds + tests + reviews all day. You click merge at night.

```
You (idea) → /finn-spec → GitHub Issue → you label it agent-ready
                                                ↓
/finn-build picks it up → codes → opens PR → /finn-review tests → verdict
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

## One-time setup (do this first)

You only do these steps once.

### 1. Install the GitHub CLI (`gh`)
The skills use `gh` to talk to GitHub. Check if you have it:
```bash
gh --version
```
If not, install it: https://cli.apache.org/packages/gh  (or `winget install GitHub.cli` on Windows)

### 2. Log in to GitHub
```bash
gh auth login
```
Follow the prompts. Pick GitHub.com → HTTPS → login in browser.

### 3. Create a GitHub repo for your project
```bash
cd /c/Users/newke/ZCodeProject
gh repo create my-finn-project --private --source=. --remote=origin --push
```
(Replace `my-finn-project` with whatever name you want. `--private` keeps it secret.)

### 4. Initialize git (if not already)
```bash
git init
git add -A
git commit -m "Initial commit: Finn-loop setup"
git branch -M main
```

### 5. Create the labels the loop uses
Run this once to create all the labels:
```bash
gh label create finn-spec               --color FBCA04 --description "Issue filed by finn-spec"
gh label create agent-ready             --color 0E8A16 --description "Spec approved by human; ready to build"
gh label create blocked                 --color B60205 --description "Builder needs a human decision"
gh label create loop-review-requested   --color 1D76DB --description "PR waiting for finn-review"
gh label create loop-changes-requested  --color D93F0B --description "Reviewer found must-fix issues"
gh label create loop-approved           --color 0E8A16 --description "Reviewer verified; ready for human merge"
gh label create needs-human-review      --color 5319E7 --description "Reviewer escalated to human"
```

### 6. (Optional) Install ZCode if you haven't
The skills live in `.zcode/skills/`. ZCode auto-discovers them. Restart ZCode after first setup so it picks them up.

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

### All day (AI): The loop runs
The build and review loops process the queue. Since ZCode doesn't have a built-in `/loop` command like Claude Code, run them yourself on a schedule:

**Option A — Manual (simplest):** Every now and then, type in ZCode:
```
/finn-build
```
…and in another session:
```
/finn-review
```

**Option B — Scheduled (more automated):** Use ZCode's cron feature to fire them every 5 minutes while you work. Ask ZCode: *"Schedule /finn-build and /finn-review to run every 5 minutes."*

### Night (~5 min): Merge
Review anything labeled `loop-approved` and click merge in GitHub:
```bash
gh pr list --label loop-approved
```
Then merge the ones you're happy with.

---

## What each skill does

### `/finn-spec` — The Interviewer
Turns your vague idea into a bulletproof spec.
- Researches your codebase first (doesn't ask dumb questions)
- Interviews you in rounds until it fully understands
- Files a GitHub Issue with AC-1, AC-2... (criteria) and NG-1, NG-2... (non-goals)
- **Never** adds `agent-ready` itself — that's your job

### `/finn-build` — The Builder
Each run does **one thing**:
1. First checks for PRs with `loop-changes-requested` and fixes them
2. Otherwise claims the oldest `agent-ready` + unassigned issue
3. Creates a branch `NN-short-name`
4. Implements ONLY the acceptance criteria
5. Runs lint/test/build locally — must pass
6. Opens a PR with `Closes #NN`, a scope ledger, test steps, risk level
7. Labels it `loop-review-requested`
8. **Never merges**

### `/finn-review` — The Reviewer
Each run reviews **one PR**:
1. Finds the oldest PR with `loop-review-requested`
2. Loads the linked issue (the contract)
3. Checks CI status and reads the diff
4. Posts a 3-group verdict: 🔴 Must fix / 🟡 Should fix / 🟢 Safe to merge
5. Labels it `loop-changes-requested` (issues found) or `loop-approved` (clean)
6. **Never merges**

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
→ Either you haven't labeled an issue `agent-ready`, or all issues are being worked. File a new spec with `/finn-spec`.

**A PR has been stuck in `loop-changes-requested` for many loops**
→ The builder may be stuck in a fix-loop with the reviewer. Read the PR comments. If they disagree, add `needs-human-review` yourself and step in.

**`gh` commands fail with "not authenticated"**
→ Run `gh auth login` again.

**ZCode doesn't see the skills**
→ Make sure the files are at `.zcode/skills/finn-spec/SKILL.md` etc. Restart ZCode.

---

## Adapting to your project

This setup assumes a typical web/app project with lint + test + build commands. If your project uses different commands (e.g. `pytest`, `cargo test`, `go test`), edit the "verify locally" steps in `.zcode/skills/finn-build/SKILL.md` to match.

---

## Credits

Adapted from Alex Finn's ["Prompting is dead" video](https://youtu.be/FRGLToHAtgc) and his [Finn-loop repo](https://github.com/finna/Finn-loop). The architecture is his; this is a ZCode + GitHub Issues port.
