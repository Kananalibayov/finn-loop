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
        back to builder          YOU merge         you decide
```

**You do exactly three things.** Everything else is a model reading the queue.

1. Add `agent-ready` when a spec looks right (the approval gate).
2. Merge PRs labelled `loop-approved`.
3. Answer issues labelled `blocked` or `needs-human-review`.

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

## 6. Running several models at once

Safe in parallel: `/finn-t3` reviewing, plus `/finn-t1` and `/finn-t2` building — **as long
as** each builder is in its own `git worktree` and their `Files In Scope` are disjoint.

Serialise: anything touching `data/app.db`, the dev server on :3000, or a shared working
tree. See the parallelism section in [`AGENT-TIERS.md`](./AGENT-TIERS.md) for why — it is a
data-integrity limit, not a speed one.

---

## 7. Your daily loop, concretely

```
1. gh pr list --label loop-approved          → merge these
2. gh issue list --label blocked             → answer these
3. gh issue list --label finn-spec --search "no:label:agent-ready"
                                             → read, and label the good ones agent-ready
4. Then: say "continue" to each model you want working.
```

That is the whole job. If step 3 is empty, run `/finn-t3` and it will refill the backlog
from `ROADMAP.md`.
