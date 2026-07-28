# Pipeline — how work flows, and how each model knows what to do next

> **The point of this document:** you should never have to tell a model what to work on.
> You open it, say **"continue"** (or run its one standing command), and it works out what
> is next from the queue itself.
>
> Coordination lives in **GitHub labels**, not in chat. If it isn't in the queue, it isn't
> real — that is `AGENTS.md` rule 1, applied to scheduling.

---

## 1. The pipeline in one picture

```
 ROADMAP.md  ──────────────► what phase we are in, in order
      │
      ▼
 ┌──────────┐   T3 writes spec + Build Card, stamps tier:tN
 │  /finn-t3│──────────────────────────────────────────────┐
 └──────────┘                                             ▼
                                              ┌─────────────────────┐
      YOU add `agent-ready`  ◄────────────────│  issue, no label yet │
      (the only approval gate)                └─────────────────────┘
                                                          │
                    ┌─────────────────────────────────────┤
                    ▼                                     ▼
            ┌──────────────┐                      ┌──────────────┐
            │  /finn-t1    │  tier:t1             │  /finn-t2    │  tier:t2
            │  GLM 5.2     │                      │  Sonnet 5    │
            └──────────────┘                      └──────────────┘
                    │            opens PR                 │
                    └──────────────┬──────────────────────┘
                                   ▼
                        `loop-review-requested`
                                   │
                                   ▼
                          ┌──────────────┐   T3, different model
                          │  /finn-t3    │   than the builder
                          └──────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
   `loop-changes-requested`  `loop-approved`   `needs-human-review`
        back to builder            │               you decide
                                   ▼
                          ┌─────────────────┐
                          │   finn-gate     │  a required CHECK, not a model
                          │  (deterministic)│
                          └─────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
          GitHub auto-merges              gate red → YOU merge
                                          by hand, deliberately
```

**You do exactly three things.** Everything else is a model reading the queue, or GitHub
acting on a deterministic check.

1. Add `agent-ready` when a spec looks right (the approval gate).
2. Answer issues labelled `blocked` or `needs-human-review`.
3. Merge by hand only what the gate deliberately refuses — `tier:t3`, protected paths,
   dangerous content.

---

## 2. Three standing commands — one per model

These never change. Same command every time, for the whole life of the project.

| Model | Command | It answers |
|---|---|---|
| **GLM 5.2** | `/finn-t1` | "What carded, mechanical work is waiting for me?" |
| **Sonnet 5** | `/finn-t2` | "What bounded module work is waiting for me?" |
| **Kimi K3 / Opus 5** | `/finn-t3` | "What needs review, spec, or architectural work?" |

Say **"continue"** or run the command. The model does the rest. It never asks you what to
build, because the queue already says.

---

## 3. What "next" means — the dispatch order

Each skill walks this list **in priority order** and does the **first** thing that matches,
then stops. One pass = one unit of work.

### `/finn-t1` and `/finn-t2` (builders)

1. **A PR I authored is labelled `loop-changes-requested`** → fix only the named must-fix
   items, push, remove the label, comment. Stop.
2. **An issue is `tier:tN` + `agent-ready` + unassigned + not `blocked`** → check its
   `## Depends on` section (§4). If deps are unmet, comment and apply `blocked`, stop.
   Otherwise claim it, build it, open a PR. Stop.
3. **Nothing matches** → say the queue is empty for this tier and stop. Do not invent work.
   Do not take another tier's issue.

### `/finn-t3` (architect, spec author, reviewer)

1. **A PR is `loop-review-requested` and I am not its author** → review it. Verdict:
   `loop-approved`, `loop-changes-requested`, or `needs-human-review`. Stop.
2. **An issue is `blocked` and the answer is architectural, not a product decision** →
   resolve it, re-card if needed, remove `blocked`. Stop.
3. **An issue is `tier:t3` + `agent-ready` + unassigned** → build it. Stop.
4. **Fewer than 3 issues are `agent-ready` across all tiers** → open `ROADMAP.md`, find the
   earliest unchecked item in the earliest incomplete phase, and spec it: write the issue,
   stamp `tier:tN`, add a Build Card if `tier:t1`. **Never add `agent-ready`.** Stop.
5. **Nothing matches** → report the queue state and stop.

Rule 4 is what makes the queue self-refilling: T3 keeps a small backlog specced ahead
without ever approving its own work.

---

## 4. Dependencies — the gap that blocked #94

Every issue that needs something else landed first **must** carry:

```md
## Depends on
- #NN must be merged (reason)
- branch `x/y` must be on main (reason)
```

Builders check this **before** claiming. If a dep is unmet: comment which one, apply
`blocked`, stop. Do not pull the dependency in — that expands scope.

**#94 is the worked example.** Its card required `npm test → pass 31`, but both `npm test`
and `lib/net.test.mts` live on the unmerged `fix/ssrf-guard-connection-test` branch. GLM
implemented the change correctly, hit the verify gate, diagnosed exactly why it was
unsatisfiable, refused to expand scope, preserved the work on a local branch, and asked.
That was correct behaviour against a **defective card** — the spec bug was mine.

**The lesson for whoever writes cards:** a card's `## Verify` commands must be runnable on
a clean branch cut from `main` *today*. If they are not, the card has a dependency and must
say so.

---

## 4a. Who merges, and what stops it

**GitHub merges. No LLM merges.** `loop-approved` is evidence a reviewer was satisfied — it is
not an instruction to merge.

`.github/workflows/finn-gate.yml` is a **required status check**. It passes only when all of:

| Condition | Why |
|---|---|
| `loop-approved` present, `needs-human-review` absent | A T3 reviewer signed off and nothing is escalated |
| Latest `Finn-loop review of <SHA>` comment == current head SHA | **The stale-review race.** GitHub does not strip labels on new commits, so the label alone proves nothing |
| No protected path in the diff | `lib/auth.ts`, `middleware.ts`, `lib/db.ts`, `lib/plesk.ts`, `lib/wp.ts`, `lib/net.ts`, `.github/**`, `.zcode/skills/**`, `Dockerfile`, `docker-compose.yml`, `package*.json`, `tsconfig.json`, `next.config.mjs` |
| No dangerous content **added** | Path lists miss semantics — a `tier:t2` PR can add `lib/sessionHelper.ts` or inline `ALTER TABLE` in a route. Scans added lines for JWT/bcrypt/secret-env/DDL/`exec(`/`eval(`/crypto calls |
| Linked issue is not `tier:t3` | T3 is *defined* as the dangerous work |

When it passes, the workflow enables GitHub's **native** auto-merge. GitHub then merges once
every required check is green. Because `finn-gate` is itself required, pushing any commit
re-runs it, the SHA stops matching, and the merge is withheld automatically.

**`.github/CODEOWNERS`** requires owner review on the same protected paths. That is deliberate
redundancy: `finn-gate` is our own code and could have a bug, whereas CODEOWNERS is enforced by
GitHub itself and cannot be bypassed by a faulty workflow.

**Kill switch.** Repo variable `FINN_AUTOMERGE`:

| Value | Behaviour |
|---|---|
| unset / anything but `on` | **Dry run.** Gate still reports pass/fail, comments what it *would* merge, applies `would-auto-merge`. Nothing merges |
| `on` | Live. Passing PRs get GitHub auto-merge enabled |

### Three outcomes, not two

| Verdict | Check | Auto-merge | Meaning |
|---|---|---|---|
| **merge** | 🟢 green | enabled | Everything clear. GitHub merges when required checks pass |
| **hold** | 🟢 green | **not** enabled | Nothing is wrong — this needs a deliberate human. Protected path, added dangerous content, `tier:t3`, or `needs-human-review`. A comment explains which |
| **block** | 🔴 red | no | Something *is* wrong: no `loop-approved`, a stale review, or CI red for this SHA |

A **hold is green on purpose.** If it went red, then with `gate` as a required check every
protected-path PR would be unmergeable without an admin bypass — and most infrastructure work
touches protected paths, so the gate would block the work needed to improve the gate.

### Who can review

**Any tier may review, as long as it is not the author.** Independence is the requirement, not
capability — the four review gates are mechanical. So **Sonnet 5 reviews GLM's `tier:t1` PRs and
GLM reviews Sonnet's `tier:t2` PRs**, and Kimi is needed only for `tier:t3` work and the
checkpoint audit.

### What is actually enforced — read this before trusting the labels

Be clear-eyed about where the real boundary is:

| Control | Enforced against an agent? |
|---|---|
| Required CI (`build`) | ✅ Mechanical. Cannot be asserted away |
| Protected-path scan | ✅ Mechanical, diff-based |
| Dangerous-content scan | ✅ Mechanical, diff-based |
| Reviewed-SHA freshness | ✅ Mechanical |
| `route-auth.test.mts` ratchet | ✅ Mechanical |
| `loop-approved` / `agent-ready` labels | ❌ **No.** Every agent authenticates as the repo owner, so `label-guard` cannot tell an agent from you |
| Branch protection | ❌ **No.** `enforce_admins` is off (required, or a red `main` plus an unreviewed revert PR would deadlock), and agents hold an admin token |

**Labels and branch protection are coordination, not security.** The mechanical checks are the
security boundary. The single highest-value change to make this real is **giving agents their own
GitHub identity** — a machine user or scoped PAT — at which point `label-guard` and branch
protection both start enforcing rather than advising.

Leave it unset until the gate's verdicts have matched your own manual decisions for a week or
two. Setting it back is an instant, total stop — no branch-protection edits needed.

**Required repo setup** (one time, in GitHub settings):
- Branch protection on `main`: require `build` **and** `finn-gate`
- Enable "Allow auto-merge"
- Enable "Require review from Code Owners"

### Verified live, not just written

Every gate was exercised against a real PR (#102) before this was documented:

| Condition | Observed |
|---|---|
| `loop-approved` absent | `BLOCKED: loop-approved is absent` |
| Label present, no review comment | `BLOCKED: no 'Finn-loop review of <sha>' comment found` |
| Review comment with the correct SHA | `Reviewed SHA matches head: 6e7aefa…` — advanced past the check |
| Diff touches protected paths | `BLOCKED: touches protected path(s): .github/CODEOWNERS .github/workflows/finn-gate.yml …` |
| New commit lands after review | `BLOCKED: review is stale` — the race closes itself |

The last row is the one that matters most. It is the only thing preventing unreviewed code
from merging under a label that GitHub never strips.

---

## 5. Label reference

| Label | Meaning | Who sets it |
|---|---|---|
| `finn-spec` | Filed by a spec pass | T3 |
| `tier:t1` / `tier:t2` / `tier:t3` | Which model owns it | T3 |
| **`agent-ready`** | **Approved to build** | **You. Only you. Ever.** |
| `blocked` | Needs a human or architectural decision | any builder |
| `loop-review-requested` | PR awaiting review | builder |
| `loop-changes-requested` | Named must-fix items | reviewer |
| `loop-approved` | Verified; ready for human merge | reviewer |
| `needs-human-review` | Reviewer escalated | reviewer |

A builder picks up work **only** when it is `tier:tN` + `agent-ready` + unassigned + not
`blocked`. Any one missing and the issue is invisible to it. That is the safe default.

---

## 6. Running several models at once — and the three cron automations

Safe in parallel: `/finn-t3` reviewing, plus `/finn-t1` and `/finn-t2` building — **as long
as** each builder is in its own `git worktree` and their `Files In Scope` are disjoint.

Serialise: anything touching `data/app.db`, the dev server on :3000, or a shared working
tree. See the parallelism section in [`AGENT-TIERS.md`](./AGENT-TIERS.md) for why — it is a
data-integrity limit, not a speed one (`better-sqlite3`, single connection, no WAL, no
`busy_timeout`).

### The three registrations

Worktrees are **not optional**. Three crons against one checkout collide on the working tree
and on the database rather than parallelising.

```bash
git worktree add ../finn-t1 -b wt/t1
git worktree add ../finn-t2 -b wt/t2
git worktree add ../finn-t3 -b wt/t3
```

| Automation | Directory | Command | May touch `data/app.db`? |
|---|---|---|---|
| Finn-loop T1 (every 5 min) | `..\finn-t1` | `/finn-t1` | No |
| Finn-loop T2 (every 5 min) | `..\finn-t2` | `/finn-t2` | No |
| Finn-loop T3 (every 5 min) | `..\finn-t3` | `/finn-t3` | **Yes — only this one** |

**There is no fourth automation for reviewing.** Review is dispatch step (a) of `/finn-t3`.

### The limitation, stated plainly

ZCode cron runs **only while ZCode is open** — see the cron section in
[`../README.md`](../README.md). Three registrations do not create 24/7 operation; they create
"autonomous while you work."

`finn-gate` plus GitHub auto-merge is the **only** part of this system that runs unattended,
because GitHub Actions is independent of the desktop app. So overnight, PRs that were already
reviewed will still merge themselves — but nothing new gets built.

---

## 7. Your daily loop, concretely

```
1. gh issue list --label finn-spec --search "no:label:agent-ready"
                                             → read, label the good ones agent-ready
2. gh issue list --label blocked             → answer these
3. gh pr list --label needs-human-review     → settle these
4. Then: say "continue" to each model, or let the crons run.
```

Note what is *not* on that list: merging. Once `FINN_AUTOMERGE=on`, PRs that clear the gate
merge without you. You only merge by hand what the gate deliberately refuses.

While the gate is still in dry run, add:

```
0. gh pr list --label would-auto-merge       → what the gate WOULD have merged.
                                               Compare to your own judgement before
                                               setting FINN_AUTOMERGE=on.
```

If step 1 is empty, run `/finn-t3` and it will refill the backlog from `ROADMAP.md`.
