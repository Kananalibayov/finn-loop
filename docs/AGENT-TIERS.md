# Agent Tiers — routing work across LLMs of different capability

> **Purpose:** this project is built by several different models of very different
> capability. This document decides **which model does which work**, and gives each tier
> instructions calibrated to what it can actually do reliably.
>
> Read with [`NORTH-STAR.md`](./NORTH-STAR.md) (what we're building) and
> [`../AGENTS.md`](../AGENTS.md) (the loop process). This document governs **who builds what**.

---

## 1. Why this exists

The original `finn-build` skill (since deleted) required independent judgment at five points: deciding
whether an acceptance criterion is ambiguous, matching "the repository's existing style,
architecture, and naming", deciding when tests are warranted, choosing the "narrowest
useful" checks, and writing per-`AC-N` evidence lines.

A frontier model handles those. A weaker model **fails all five in the same
characteristic way: it proceeds instead of stopping, and then reports success.** It
guesses at ambiguity rather than asking, invents a plausible-looking pattern rather than
copying the real one, skips tests, and writes confident evidence lines for verification
it never ran.

That failure mode is exactly what produced this codebase's worst defects — see the
"Broken but reports success" section of
[`STATE-OF-THE-BUILD.md`](./STATE-OF-THE-BUILD.md). Seven separate features report
success while doing nothing.

**The fix is not a better prompt. It is to stop asking weak models to make decisions.**
Strong models decide and write an executable plan; weak models execute it mechanically
and are structurally unable to drift.

---

## 2. The tiers

Tiers are **roles, not vendors, and not model names.** Vendors ship new models constantly;
this section is written so it does not go stale when they do.

Fill each slot from your roster using the placement test below. Any model in a slot may do
that slot's work — they are interchangeable within a slot.

| Slot | What it does | What it needs | Never give it |
|---|---|---|---|
| **T3-A — Architect** | Decides the schema, the publish/page-ownership model, the SiteModel, the credential lifecycle. Its output is a decision, not a diff | **The strongest model you have**, highest reasoning effort. Cost is irrelevant here — these decisions are made once and everything else depends on them | Nothing. This slot has no restrictions |
| **T3-S — Spec author** | Turns a decision into a Build Card a weak model executes exactly (§5) | **The strongest model you have.** A wrong card is worse than no card — it converts a spec bug into a builder bug you pay for at review time | — |
| **T3-R — Reviewer** | Evidence gate → scope gate → invariant gate → correctness (§8) | **Strongest available, and never the same model *or* session that built it.** Prefer a different vendor | Authority to fix what it finds. It reports; the builder fixes |
| **T2 — Implementer** | Implements an `AC-N`/`NG-N` spec inside a named file set | A capable mid-tier model. This is where mid-tier genuinely pays — the judgment required is local | Schema, auth, crypto, cross-module refactors, contract changes |
| **T1 — Executor** | Applies a Build Card mechanically | The cheapest model that reliably follows a card **and stops when unsure**. Coding-tuned matters far more than parameter count | Goals, trade-offs, "figure out the best way", raw GitHub issues |

### Placement test — how to slot any model, including ones released after this was written

Run each check on real work from this repo. Promote or demote on what you observe, never on a
benchmark score or a vendor's positioning.

| Check | If it passes |
|---|---|
| Given a goal and constraints, does it hold a 4–5 file change coherently and name the trade-off it chose? | **T3-A capable** |
| Does a Build Card it authored get executed correctly, first try, by your T1 model? | **T3-S capable** |
| On a diff with a planted bug, does it find the real bug **without** generating false must-fixes? (LLM reviewers systematically overcorrect on requirement conformance — a reviewer that flags conforming code is worse than no reviewer) | **T3-R capable** |
| Given a spec and a named file set, does it implement it **without widening scope** or renaming things it was not asked to touch? | **T2 capable** |
| Given a deliberately ambiguous card, does it **stop and ask** rather than guess? | **T1-safe** |
| Does it ever claim a check it did not run? | **Not usable at any tier** until scaffolded per §7 |

That last check matters most and is the one most models fail: 88% of agent trajectories
narrate self-verification, and 35.7% of those still ship a wrong patch.

### Match model scarcity to token volume, not just to difficulty

The intuitive allocation — "strongest model on the hardest work" — wastes a scarce model,
because difficulty and token volume are not the same axis:

| Work | Token volume | Cost of getting it wrong |
|---|---|---|
| **A decision** (schema shape, page-ownership model, whether the LLM may emit markup) | **Low** — one conversation and a doc | Catastrophic and often irreversible |
| **An implementation** (build the section registry, write the renderers) | **High** — long sessions, many files, many iterations | Recoverable; the diff is reviewable |
| **An audit or sweep** (find every instance across 53 routes) | **Very high** — must read broadly | Low; findings get verified anyway |

So: put your **scarcest, strongest** model on decisions, because decisions are cheap in tokens
and expensive to get wrong. Put your **highest-budget strong** model on implementation, because
that is where the tokens actually go. Never burn a rationed model on a sweep.

### Roster and standing assignment

| Model | Standing slot | Why here |
|---|---|---|
| **Claude Fable 5** | **T3-A decisions only** — the irreversible ones: schema rebuild, publish/slug-ownership, credential lifecycle, "may the model emit markup". Plus second reviewer on those | Rationed. Decisions are low-volume, so a rationed model fits exactly. Do not use it to implement or sweep |
| **GPT 5.6 Sol** | **Escalation / tie-break only.** The independent third opinion when a T3-A decision is contested or a two-reviewer split needs breaking | Minimal plan. `Sol Ultra` parallelises with subagents (91.9% vs 88.8% on Terminal-Bench 2.1 agentic coding) — worth spending on one hard call, not on volume |
| **Kimi K3 Max** | **T3 implementation workhorse.** Build the section registry, the renderers, the job runner, the schema migration | Designed for exactly this: sustained multi-step engineering sessions — read repo, run tests, interpret failures, iterate. 1M context. High budget, so use it heavily |
| **Kimi K3 Swarm Max** | **Breadth work.** Audits, multi-file sweeps, migrations across many call sites, option exploration, parallel verification | Agent Swarm coordinates parallel sub-agents. Ideal for "find every instance of X". See the caution below |
| **Claude Opus 5** | **T3-R primary reviewer** (cross-vendor from Kimi) and T3-A alternate | Good plan, regular use. Being a different vendor from your main builder is exactly what the review rule needs |
| **Claude Sonnet 5** | **T2 workhorse.** All `[T2]` issues | Good plan. Bounded module work with local judgment is its sweet spot |
| **ZCode GLM 5.2** | **T1 executor.** Carded `[T1]` issues on the cron loop | Good plan, coding-tuned, and it passed the stop-when-unsure check on its first real run |
| **GPT 5.6 Terra / Luna** | **No standing slot.** On a $20 seat plan the quota is better spent on a handful of Sol tie-breaks than on volume Terra/Luna could do | GLM 5.2 already covers cheap code work and is coding-tuned. Adding a second cheap generalist buys nothing but another tool to babysit |

**The default pairing is Kimi builds, Opus 5 reviews.** Both are high-budget and different
vendors, which satisfies the never-review-your-own-work rule without touching a rationed model.
Fable 5 and Sol stay out of the routine loop.

### Caution on swarm and parallel-subagent modes

`K3 Swarm Max` and `Sol Ultra` both get their advantage by fanning out to parallel sub-agents.
That is excellent for **discovery** — breadth, coverage, "find everything" — and it is how the
162-defect audit in [`GAP-LEDGER.md`](./GAP-LEDGER.md) was produced.

It is a worse fit for producing **one coherent surgical diff**, where parallel workers can
each make locally-reasonable but mutually inconsistent choices. So:

- **Swarm / Ultra** → audits, sweeps, exploring options, verification fan-out.
- **K3 Max (non-swarm)** → implementing a single feature coherently.

### A specific assignment worth making

Kimi K3 has native **visual-to-code and screenshot-based debugging.** Two pieces of this
roadmap are exactly that shape and should go to it deliberately:

- `template-from-image` / `template-from-url` intake — currently reconstructs design from class
  names with the CSS stripped (see [`STATE-OF-THE-BUILD.md`](./STATE-OF-THE-BUILD.md)).
- Visual QA of section-registry variants at 360 / 768 / 1280 / 1920 px against the
  [`NORTH-STAR.md`](./NORTH-STAR.md) §4 quality bar.

### On lower-tier variants from a strong vendor

Do not assume a smaller model from a frontier lab beats GLM 5.2 at T1. T1 work is mechanical
instruction-following on code — exactly what coding-tuned models are trained for and what small
general-purpose models are weakest at. Small-model failures concentrate in tool use and syntax
(42% tool-use errors for one open model), which is precisely T1's job description. Put cheap
frontier variants at **T2**, where local judgment is the actual requirement, and test first.

### Cross-vendor review

The reviewer must never be the builder's model **or** session — a 35.7% self-verification
failure rate means the check cannot live inside the agent being checked. Prefer **crossing
vendors**: different training lineages fail differently, so an error one model is blind to is
more likely visible to another.

**The rule is "a different model than the author" — not "a frontier model."** Review needs
independence, not raw capability. Getting this wrong is what made Kimi a per-PR dependency and
a bottleneck.

| Built by | Review with | Notes |
|---|---|---|
| **GLM 5.2** (`tier:t1`) | **Sonnet 5** | The default pairing for carded work. T1 diffs are small and fully specified — Sonnet is more than adequate, and this needs no Kimi at all |
| **Sonnet 5** (`tier:t2`) | **GLM 5.2** | The reverse. GLM can run the four gates: evidence, scope, invariants, re-run the checks |
| Kimi K3 (`tier:t3`) | Opus 5 | Frontier work gets a frontier reviewer |
| Opus 5 (`tier:t3`) | Kimi K3 | Reverse of the above |
| Fable 5 | Opus 5 or Kimi K3 | Rare — Fable 5 mostly decides rather than builds |

**So Kimi is needed for exactly two things:** implementing `tier:t3` work, and the checkpoint
audit (`/finn-audit` — see [`PIPELINE.md`](./PIPELINE.md) §2 and
[`../.zcode/skills/finn-audit/SKILL.md`](../.zcode/skills/finn-audit/SKILL.md)). It is not in
the per-PR loop.

Why this is safe: `finn-t3` step (a) already forbade reviewing your own PR, and its four gates
are mechanical — is there literal command output, are the files in scope, does the diff violate
an invariant, do the checks pass when re-run. None of that requires frontier reasoning. What
*does* require it is deciding the schema or the publish model, which is why those stayed
`tier:t3`.

Same-family, different-model review (Opus 5 reviewing Fable 5) is acceptable. Same-model
review is not.

**For the highest-risk items** — the schema rebuild, the publish/slug-ownership model, the
credential lifecycle, anything touching secrets — require **two independent T3 reviews from
different vendors**: Opus 5 plus Kimi K3, escalating to **Fable 5 or GPT 5.6 Sol only if they
disagree.** Those are the changes where a plausible-looking wrong implementation writes
irreversibly to a client's production WordPress, or drops rows in a migration you cannot roll
back — and a rationed model is worth spending on a tie-break there.

### Running several agents at once

Yes — but this repo has two hard serialisation points, and ignoring them corrupts state
rather than merely slowing things down.

**Runs safely in parallel, any number:**

- Read-only work — audits, sweeps, research, spec authoring, code review. Nothing to collide.
- Builders in **separate git worktrees** with **disjoint `Files In Scope`**.
- A reviewer on PR A while a builder works PR B.

**Must be serialised — one at a time, repo-wide:**

| Serialisation point | Why | Consequence of ignoring it |
|---|---|---|
| **`data/app.db`** | `better-sqlite3` is a synchronous in-process binding on a single cached connection, with **no WAL and no `busy_timeout`** (see [`GAP-LEDGER.md`](./GAP-LEDGER.md) pattern 3). Default rollback-journal mode means writers block readers | A second process touching the file gets `SQLITE_BUSY` with no retry, or tears the file mid-write |
| **The dev server on :3000** | One port, one process | The second agent silently tests the first agent's build |
| **A single working tree** | Two builders editing one checkout | Each sees the other's half-finished edits; `git status` preflight fails or, worse, one commits the other's work |
| **The builder claim lock** | The cooperative lock is `gh issue edit --add-assignee`, which is per-GitHub-account, not per-tier | Two builder loops can race for the same issue. Mitigated because `finn-t1` and `finn-t2` filter on *different* `tier:` labels, so their queues are disjoint by construction |

**The safe parallel setup** — give each code-writing agent its own checkout:

```bash
git worktree add ../finn-a -b <branch-a>
git worktree add ../finn-b -b <branch-b>
```

Then: only **one** agent runs `npm run dev` or touches `data/app.db`. Everyone else runs
`npx tsc --noEmit` and `npm test`, which are pure and parallel-safe.

**Practical concurrency ceiling for this repo:** one dev-server/DB agent, plus two or three
worktree builders on disjoint files, plus unlimited read-only reviewers and auditors. Beyond
that you are queueing on the database, not on model capacity.

### Why tier at all — the honest tradeoff

**Quality-optimal is one strong model doing everything.** A controlled coding benchmark found
solo frontier at 97/100, and every planner+executor mix scored worse on quality, cost, or both
once planner overhead was counted.

**Tiering exists to make the unattended cron loop affordable, not to improve output.** So:

- Runs **unattended on the 5-minute loop** → tier it; T1 executes carded work.
- You are **present and iterating** → just use your strongest model. Do not tier by reflex.
- **Architectural, security-relevant, or irreversible** → strongest model regardless of cost,
  plus cross-vendor review.

If an issue's implementation steps cannot be fully enumerated in advance, it does not belong
at T1 or T2 at any price.

---

## 2a. Why tiering is worth doing — and its one honest limitation

The measured effect is large and it is **specifically largest where the executor is
weakest**. On a controlled greenfield build benchmark, a GLM-class model scored **46/100
working solo and 93/100 executing a frontier-authored plan** — a 47-point lift.
Kimi-class, already scoring 87–97 solo, gained only ~10 from the same orchestration. The
rule: *the lift scales inversely with the executor's solo capability.*

**The honest limitation:** a single frontier model working alone still beats every
planner+executor mix on quality, and often on total cost once planner overhead is counted.
So state the reason plainly and do not overclaim:

> **We use GLM-class builders because they let the 5-minute cron run unattended at low
> marginal cost — not because tiering improves quality.** Any issue whose implementation
> steps cannot be fully enumerated in advance goes to the frontier tier instead. Never
> delegate genuinely open-ended work down a tier.

### What weak models actually get wrong

Failures are concentrated in **mechanics, not reasoning** — so scaffolding must target
mechanics. The evidence, and the rule each one produces:

| Measured failure mode | Rule it produces |
|---|---|
| Tool-use errors dominate small-model failures (42% for one open model); syntax and formatting next | Specify exact **paths and symbols**, never intent. Never "update the pairing endpoint" — write `app/api/wp/pairing/register/route.ts` and the exported symbol |
| Context overflow is the top agentic failure mode (63% for one frontier model; "stuck in long file reading" 62%). GLM-4.6 loses **7.45pp accuracy from 32K→128K**, and GLM-5's own paper concedes substantial degradation past 100K | **`## Files In Scope`, ≤ 5 paths**, plus "read ONLY these plus `docs/NORTH-STAR.md`; if you believe another file must be read, stop and apply `blocked`." This repo has **53 `route.ts` files** — unbounded exploration exhausts context before any edit lands |
| Rule-following **collapses abruptly**, not gracefully, past a model-specific capacity — and coupling a rule list to a coding task is empirically the worst case, because procedural tracking and reasoning compete for the same capacity | **Cap binding constraints at 7**, flat numbered list. Push everything else into lint or CI rather than prose |
| GLM-class models **silently ignore mid-run corrections** after an interruption and resume the original trajectory | **No mid-run steering.** If a run goes wrong: kill it, edit the issue text, restart from a clean branch. A chat correction will be dropped and you will ship the pre-correction trajectory |
| **88% of agent trajectories narrate self-verification; 35.7% of those still ship a wrong patch.** "Implementation complete" routinely covers TODO-only bodies | Evidence with **captured output and exit codes** (§7). The check must not live inside the agent being checked |
| Context compaction **manufactures confirmed results from killed processes** — partial terminal output becomes "verified" fact downstream | Final verification must be **one fresh command run immediately before opening the PR, written to a file and read back**. Never cite a result observed before the last compaction |
| Hallucinated APIs are mostly **schema misalignment** — the model emits the name pretraining expects. Aligning names to what exists cut those errors ~80% | **`## Existing API you MUST use`** with the real TypeScript signatures pasted verbatim. This repo has 19 same-shaped `lib/` modules — prime conditions for inventing `updateWpConnection`, which does not exist |
| Scope creep is the **default**, not the exception; the constraints block is the highest-ROI section of any spec | An explicit standing forbidden list every builder inherits (§5) |
| Editing the verifier is the cheapest way to satisfy it. Blocking that shortcut cut "hacked resolved" from 28.6% → 0.6% **and raised genuine solve rate** from 40% → 61% | Tests, CI and `tsconfig.json` are **write-protected** from the executor. Reviewer diffs for those paths first and rejects on sight |
| Rule adherence **decays with turn count**; 5% of trials violate basic format instructions outright | **Restate the five non-negotiables in the last 10 lines** of the builder prompt, and require the builder to re-print them immediately before opening the PR. `AGENTS.md` loaded at session start is not governing behaviour 40 tool calls later |
| Over-constrained output schemas impose a real **"constraint tax"** — for weak models the schema competes with the task | Fix the PR body at **exactly five headings**. No nested schemas, no per-file justifications, no scoring rubrics |

### The repo-specific trap

Because [`GAP-LEDGER.md`](./GAP-LEDGER.md) pattern 1 ("success is a returned shape") is
present in *every* subsystem, a weak executor told to "fix the silent failure" **will fix
it by adding another swallow.** Any T1 card touching an effectful path must name the
**exact discriminated union to return and the exact error string** — never the intent.

---

## 3. Routing rules

Decide the tier **before** filing the issue. Write it in the issue title as `[T1]`,
`[T2]` or `[T3]`.

### Route by blast radius, never by diff size

This is the most common routing error and the audit made it concrete. Of the 162 verified
gaps, the auditors tagged ~85 as "mechanical" — but they tagged them from **diff size**,
and diff size is not blast radius:

| Gap | Diff | Actually |
|---|---|---|
| `math-random-provisioning-credentials` | one file | **crypto → T3** |
| `port-published-on-all-interfaces` | one line of compose | **deployment security boundary → T3** |
| `uploads-route-behind-auth` | one line of middleware | **changes a public route's auth → T3** |
| `insertproject-two-statement-null-group` | one line | **touches the schema block of `lib/db.ts` → T3** |

Correct routing of the surviving work is **62 T1 / 74 T2 / 26 T3**, not the tagged
85/65/12. **Ask what an incorrect diff destroys, not how many lines it is.**

Route to **T1** only when *all* are true:
- The change touches ≤ 3 files, all named in advance.
- There is an existing pattern in this repo to copy, cited by file and line.
- No design decision remains — a competent engineer would produce the same diff.
- No schema change, no auth change, no crypto, no deletion path, no new dependency.
- Success is verifiable by a command whose output is unambiguous.

Route to **T2** when the work is confined to one module and needs judgment about
*implementation* but not about *contracts or architecture*.

Route to **T3** when any of these hold — **no exceptions**:
- Touches `lib/auth.ts`, `middleware.ts`, or the schema block of `lib/db.ts`.
- Touches secrets, tokens, password handling, or the SSO / pairing / health-report flows.
- Touches the `SiteModel`, a renderer, or the section component library.
- Changes an API contract, a database column, or a public route's auth requirement.
- Adds a dependency, changes CI, or changes the Docker/deploy setup.
- Involves a destructive operation (delete, overwrite, migrate, bulk update).
- Is a refactor spanning modules, or the work is exploratory.
- You cannot write the Build Card without first reading code to decide *what* to do —
  that reading **is** the T3 work.

**Escalation is always allowed and never penalised.** A T1 pass that stops and asks is a
success. A T1 pass that guesses is a failure even if the code happens to work.

---

## 4. Universal contract — every tier, every pass

1. Read [`NORTH-STAR.md`](./NORTH-STAR.md). State which Golden Path step your change
   serves. If it serves none, stop.
2. **Never report success for work that did not happen.** No empty `catch`. No fallback
   that returns a success shape. No "✓ done" unless you observed it done. This is
   Invariant 4 and it is the single most important rule in this repo.
3. **Never fabricate verification.** See §7.
4. Never commit secrets. Never write credentials to a log, a file, or a response body.
5. Never merge. Never enable auto-merge. Never push to the default branch.
6. Working tree must be clean before you start. Never stash, reset, or commit someone
   else's work.
7. Non-goals are binding. If an acceptance criterion requires violating one, stop and say
   so — do not resolve the conflict yourself.

---

## 5. T1 — the Executor

### You may only work from a Build Card

If the issue does not contain a `## Build Card` section, **stop immediately** and comment:

> This issue is not carded for T1. Requesting a Build Card from T3.

Then add label `needs-human-review`, unassign, and end the pass. Do not attempt the work
from the acceptance criteria alone.

### The nine required sections — a missing one is a spec bug

`finn-spec` (T3) **must refuse to file** a `[T1]` issue unless all nine are present and
non-empty. Filing an incomplete card converts a spec bug into a builder bug you pay for at
review time.

1. **Golden Path step served**
2. **Files In Scope** — ≤ 5 paths (T1: ≤ 3)
3. **Existing API you MUST use** — real signatures, pasted verbatim
4. **Implementation Steps** — ordered, numbered, one per file
5. **Acceptance Criteria** — as `AC-n: <command or request> → <expected output/status>`
6. **Constraints (binding)** — flat numbered list, **≤ 7**
7. **Non-goals / forbidden actions**
8. **Budget** — `≤ 3 files, ≤ 200 changed lines`
9. **Blocked-if conditions**

**Acceptance criteria must be runnable, not prose.** Not "pairing should work reliably" but:

```
AC-2: curl -s -X POST localhost:3000/api/wp/pairing/register -d '{}' → 400 with {error}
```

Prose ACs are rejected at spec time. The reviewer's verdict must quote each `AC-n` id and
its observed result.

### The Build Card format

T3 authors this. It is the complete contract.

```md
## Build Card
Tier: T1
Golden Path step: <n>
Invariants in play: <ids from NORTH-STAR §3>

### Files you may create or edit
Editing anything not on this list means STOP.
- path/to/new-file.ts        (CREATE)
- path/to/existing.tsx       (EDIT — anchor below)

### Read-only reference — copy these patterns exactly
- path/to/model.ts:12-40     ← the shape your new file must match

### Anchor
The exact existing text you will edit next to, quoted verbatim.
If this text is not present in the file, STOP — the file has changed since carding.

### Steps
1. …explicit, ordered, one action each, naming identifiers and literals…
2. …
### Forbidden in this card
- Do NOT modify <files that look related but are out of scope>
- Do NOT add dependencies, rename anything, reformat, or refactor
- Do NOT "improve" adjacent code you notice is wrong — report it instead

### Verify — run exactly these and paste the literal output
```bash
npx tsc --noEmit
npm run build
```

### Definition of done
- [ ] observable, checkable outcome
- [ ] …

### STOP conditions
End the pass and comment instead of proceeding if:
- the Anchor text is absent
- a step requires editing a file not on the allow-list
- typecheck reports an error you cannot fix inside the allowed files
- any step is ambiguous to you
```

### Hard prohibitions for T1 — regardless of what a card says

If a card asks for any of these, the card is wrong. Stop and escalate.

- Editing `lib/auth.ts`, `middleware.ts`, or the schema/`ALTER` block of `lib/db.ts`.
- Anything touching passwords, tokens, JWTs, secrets, or the pairing/SSO/health flows.
- Writing a database migration or changing a column.
- `git reset`, `git checkout --`, `git clean`, force-push, or deleting files not created
  in this pass.
- Adding or upgrading a dependency.
- Editing `.github/workflows/`, `Dockerfile`, `docker-compose.yml`, `next.config.mjs`,
  `package.json`, or `tsconfig.json`.
- **Modifying, deleting or skipping any test.** Weakening TypeScript strictness. Editing
  the verifier is the cheapest way to satisfy it, and blocking that shortcut measurably
  raises genuine solve rate — it is not merely a purity rule.
- Renaming or moving any existing file.
- Changing more than the files on the allow-list.

### Budget

`≤ 3 files, ≤ 200 changed lines.` **Exceeding the budget means the issue was mis-sized** —
stop, comment the reason, apply `blocked`. Do not ship a large PR. This is the existing
"one issue = one PR, ≤ 1 day" rule turned into something a weak model can actually check.

### The last ten lines of every T1 prompt

Rule adherence decays with turn count, so these are restated at the end of the prompt and
the builder **re-prints them immediately before opening the PR**:

```
1. Only the files in ## Files In Scope. Nothing else.
2. No new dependencies. No test, CI, or tsconfig edits.
3. Evidence block with real command output and exit codes, or the PR is rejected unread.
4. You are not authorised to make design decisions. If the card does not determine the
   answer, do not choose — comment the exact ambiguity, apply `blocked`, stop.
5. `blocked` is a success. A guessed design decision is a failure even if the code works.
```

### How to behave when something is off

You will sometimes notice a real problem outside your card. **That is expected and
useful.** Do not fix it. Add one line to your PR body under
`Observed but out of scope:` and carry on. Fixing it silently expands scope and is a
review failure.

---

## 6. T2 — the Implementer

You get an `AC-N`/`NG-N` issue and a named file set, and you choose the implementation.

- Match existing patterns; cite the file you copied from in the PR.
- You may add tests. You may not change public contracts, schema, or auth.
- If you find yourself needing to edit a file outside the named set, stop and ask for the
  set to be amended. Do not widen it yourself.
- Everything in §4 and §7 applies.

---

## 7. Anti-fabrication rules — all tiers

The most damaging thing an agent does here is claim verification it did not perform.

- Every check you claim must be accompanied by its **literal terminal output**, pasted.
  Not paraphrased, not summarised.
- If you did not run a command, write `NOT RUN` next to it. That is an acceptable answer.
  An invented result is not.
- If a check fails and you cannot fix it inside your allowed files, report the failure
  verbatim and stop. A failing check reported honestly is a good pass.
- Per-`AC-N` evidence lines must describe something you **observed**, and say how. "AC-2:
  implemented" is not evidence. "AC-2: ran `curl -X PATCH …`, got `{"ok":true}`, verified
  row updated" is.
- Never write "tests pass" in this repo without naming the command. There is currently no
  test runner configured — if you claim tests passed, you fabricated it.

**Reviewer rule (T3):** reject any PR whose evidence lines contain no literal command
output. Do not read the diff first — check the evidence first. This one gate would have
caught most of the defects in `STATE-OF-THE-BUILD.md`.

---

## 8. T3 — the Architect and Reviewer

### Authoring Build Cards

A card is correct when **you could hand it to a competent junior with no context and get
the diff you intended.** Test it against three failure modes before filing:

1. *Could this be misread?* Any sentence with two readings must be rewritten.
2. *Does it require a decision?* If the executor must choose, you have not finished
   deciding. Decide, then card it.
3. *Is the anchor real?* Open the file and copy the text. Never write an anchor from
   memory — files change.

Card the **verification** as precisely as the change. If the only check is `tsc`, say so;
do not write "run the relevant tests" to a tier that cannot judge relevance.

### Reviewing

Order matters:
1. Evidence gate (§7). No literal output → reject, do not read further.
2. Scope gate: does the diff touch only the allow-listed files?
3. Invariant gate: check against [`NORTH-STAR.md §3`](./NORTH-STAR.md), especially
   Invariant 4 — search the diff for empty catches, success-shaped fallbacks, and
   swallowed errors.
4. Then correctness.

**Constrain the review symmetrically.** LLM reviewers systematically *overcorrect* on
requirement conformance — they flag conforming code as non-conforming and generate false
must-fixes. So the reviewer may block on **only four things**:

1. A named failing `AC-n`
2. A file touched outside `## Files In Scope`
3. A violated Constraint
4. Absent or invalid Evidence

Style preferences, suggested refactors and "consider also…" notes go in a **non-blocking**
section and never produce `loop-changes-requested`. Ground the verdict in **re-run
commands**, not in reading the diff — interactive judges grounded in runtime behaviour
resist the length-exploitation that static diff-reading judges fall for.

Three verdicts only, no fourth: `loop-approved` (all ACs verified green),
`loop-changes-requested` (a named AC failed), `needs-human-review` (an AC is unverifiable,
CI is missing, or the spec is ambiguous). Reviewer confidence is not a verdict.

### T3 may not delegate

Authoring every Build Card, reviewing every PR, and implementing the T3 list are
**non-transferable**. And the reviewer must never be the builder's model *or* the builder's
session — a 35.7% self-verification failure rate means the check cannot live inside the
agent being checked.

### Work T3 keeps

The 26 T3 items fall into seven clusters. In each, the work **is** deciding what the
contract should be, and the characteristic weak-model failure — proceed, then report
success — produces an irreversible write to a client's production WordPress, a permanently
lost credential, or a migration that silently drops rows.

| Cluster | Why T3 |
|---|---|
| **a. The schema rebuild** — migrations, foreign keys, CHECK constraints, indexes, WAL, the `sites`/`site_versions` split, `delivered_pages` UNIQUE | SQLite cannot `ALTER`-add a foreign key, so each is a create/copy/drop/rename inside one transaction. A partial rebuild against a production `data/app.db` **with no working backup** is unrecoverable |
| **b. The publish step and front-page configuration** | Getting slug adoption wrong is the defect that already rewrites clients' live pages. The fix requires deciding an ownership model, not adding a status field |
| **c. The durable job runner and its idempotency contract** | Every other subsystem then depends on it |
| **d. The Section Registry vs sanitizer decision** | Whether the model may emit markup at all is the highest-leverage architectural call available, and it validates or invalidates dozens of downstream items |
| **e. Credential lifecycle + every pairing/SSO/health protocol change** | Secrets and cross-system auth — already T3-only without exception under §3 |
| **f. Cross-cutting contracts** — the single response envelope across 53 handlers, the cost ledger, rate limiting, body-size limits, `assertPublicHttpTarget` | Coordinated multi-file changes where partial application leaves the system **worse** than before |
| **g. Everything in CI, Dockerfile, compose and DEPLOY.md** | These are the only remaining verifier. A weak model that weakens them removes the ability to detect its own future failures |

### T3 owns sequencing — and one constraint dominates

**Do not let any tier wire `assignProjectToClient` / set `sites.client_id` until the
change-request state machine, the apply route's per-page failure accounting, and group-head
resolution are all merged.** Roughly 35 latent defects go live simultaneously the moment
`client_id` becomes settable. See the landmine section in
[`GAP-LEDGER.md`](./GAP-LEDGER.md).

---

## 9. Worked example — a real T1 Build Card

This is the client-assignment fix from [`../ROADMAP.md`](../ROADMAP.md) Phase 0, carded
for T1. Note that every path, identifier and anchor below is real.

```md
## Build Card
Tier: T1
Golden Path step: 8 (Handoff)
Invariants in play: 11 (a project must not lose its client link), 12 (server-side isolation)

### Files you may create or edit
- app/api/projects/[id]/client/route.ts   (CREATE)
- app/projects/[id]/page.tsx              (EDIT — anchor below)

### Read-only reference — copy these patterns exactly
- app/api/wp/connections/[id]/login-token/route.ts:11-24
    ← your route's param handling, id validation and 404 shape must match this exactly
- app/projects/[id]/page.tsx:314-349
    ← the "Push target" picker. Your client picker is this pattern with different data.

### Anchor
In app/projects/[id]/page.tsx, immediately BEFORE this exact line:

      {/* AC-6 (issue #30): push result inline. */}

If that line is not present, STOP.

### Steps
1. CREATE app/api/projects/[id]/client/route.ts:
   - `export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"`
   - import { assignProjectToClient, getProject } from "@/lib/db"
   - export async function PATCH(req, { params }: { params: Promise<{ id: string }> })
   - const { id } = await params; const num = Number(id)
   - if (!Number.isInteger(num) || num <= 0) → 400 { error: "Invalid id." }
   - if (!getProject(num)) → 404 { error: "Project not found." }
   - parse JSON body; on parse failure → 400 { error: "Invalid JSON body." }
   - read clientId; accept a positive integer or null; anything else → 400
     { error: "clientId must be a positive integer or null." }
   - call assignProjectToClient(num, clientId)
   - return NextResponse.json({ ok: true })
2. EDIT app/projects/[id]/page.tsx: insert a new <section className="card"> directly
   before the Anchor line, containing a <select id="client"> labelled "Client" plus an
   "Assign" button, wired to PATCH /api/projects/${id}/client with { clientId }.
   Populate options from GET /api/clients. First option: value "" / label "Unassigned".
   Mirror the layout, class names and inline styles of the reference at lines 314-349.

### Forbidden in this card
- Do NOT modify lib/db.ts — assignProjectToClient already exists at lib/db.ts:1026
- Do NOT modify regenerateProject (a separate carded issue covers it)
- Do NOT add dependencies, rename anything, or reformat existing lines

### Verify — run exactly these and paste the literal output
```bash
npx tsc --noEmit
npm run build
```

### Definition of done
- [ ] `npx tsc --noEmit` produces no output
- [ ] PATCH /api/projects/1/client with {"clientId":1} returns {"ok":true}
- [ ] PATCH /api/projects/abc/client returns 400 {"error":"Invalid id."}
- [ ] PATCH /api/projects/999999/client returns 404
- [ ] The project page shows a Client picker above the push-result notice

### STOP conditions
- The Anchor line is absent from app/projects/[id]/page.tsx
- assignProjectToClient is not exported from lib/db.ts
- Any step would require editing a file not listed above
```

**Why this is safe for T1:** every decision is already made. There is a real pattern to
copy at a cited line range. The anchor is verbatim. The verification is exact. Nothing
about schema, auth, or secrets is involved. The forbidden list closes the two adjacent
files a weak model would otherwise wander into.

---

## 10. Mapping onto the existing loop

| Skill | Slot | Status |
|---|---|---|
| `finn-spec` | T3-S | Interactive spec interview, human present. Must emit a Build Card for `[T1]` issues and stamp the tier label |
| **`finn-t1`** | T1 | Refuses uncarded issues, checks `## Depends on` and that verify commands exist, verifies the anchor before editing, forbids exploration, captures exit codes |
| **`finn-t2`** | T2 | Bounded module work inside a named file set. May not change schema, sessions, or secrets |
| **`finn-t3`** | T3-A / T3-S / T3-R | Review, unblock, build `tier:t3`, refill the backlog from `ROADMAP.md` |

`finn-build` and `finn-review` were **deleted** — they duplicated `finn-t2` and `finn-t3`
step (a), and `finn-build` was the last place an LLM ran `gh pr merge`. Two reviewers with two
definitions of a verdict is dangerous now that `loop-approved` feeds a merge gate.

**Which skill to run:**

```
T1 slot  (GLM 5.2)                  →  /finn-t1   (carded [T1] issues only)
T2 slot  (Sonnet 5, mid-tier)       →  /finn-t2         ([T2] issues)
T3 slots (your strongest models)    →  /finn-t3         (review, unblock, build, refill)
                                    →  /finn-spec       (interactive, you present)
```

**Stamp the tier in the issue title** — `[T1]`, `[T2]`, `[T3]`. `finn-t1` picks only
`[T1]`; `finn-t2` picks only `[T2]`. An unstamped issue is not pickable by any builder,
which is the safe default.

### Merge authority — resolved

This document previously flagged a live contradiction: `AGENTS.md` forbade agents from
merging in two places and authorised auto-merge in a third, while `finn-build` §0a actually
ran `gh pr merge` from the builder LLM.

**Resolution: no LLM merges — GitHub does.** `.github/workflows/finn-gate.yml` is a required
status check that passes only when `loop-approved` is present, `needs-human-review` is absent,
the reviewed SHA equals the current head, the diff trips no protected-path or
dangerous-content rule, and the linked issue is not `tier:t3`. When it passes it enables
GitHub's *native* auto-merge; GitHub performs the merge. `finn-build` was deleted.

Two properties worth understanding:

- **The stale-review race closes itself.** GitHub does not strip labels when new commits land,
  so `loop-approved` alone is not proof. Pushing any commit re-runs the gate, the reviewed SHA
  stops matching head, the check goes red, and GitHub withholds the merge.
- **The diff-based scan is primary; the tier label is redundancy.** `tier:tN` is LLM-assigned
  at spec time, so a mis-tiered auth issue is exactly the failure the blast-radius rule exists
  for. A `tier:t1` PR that touches `lib/auth.ts` is still blocked. `.github/CODEOWNERS`
  additionally requires owner review on those paths — a GitHub-native backstop that survives a
  bug in our own workflow.

Kill switch: repo variable `FINN_AUTOMERGE`. Anything but `on` is dry-run.

---

## 11. One-line summary per tier

- **T1 (GLM 5.2):** *Execute the card exactly. Change nothing else. If anything surprises
  you, stop and say so. Never claim a check you did not run.*
- **T2:** *Implement the spec inside the named files. Copy existing patterns. Do not widen
  scope or change contracts.*
- **T3 (Fable, Kimi):** *Decide everything. Card the work so precisely that a weak model
  cannot drift. Review evidence before code. Keep the dangerous work yourself.*
