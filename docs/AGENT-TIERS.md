# Agent Tiers — routing work across LLMs of different capability

> **Purpose:** this project is built by several different models of very different
> capability. This document decides **which model does which work**, and gives each tier
> instructions calibrated to what it can actually do reliably.
>
> Read with [`NORTH-STAR.md`](./NORTH-STAR.md) (what we're building) and
> [`../AGENTS.md`](../AGENTS.md) (the loop process). This document governs **who builds what**.

---

## 1. Why this exists

The existing `finn-build` skill requires independent judgment at five points: deciding
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

Tiers are **capability bands, not vendors.** Any model in a band may do that band's work —
they are interchangeable within a tier.

| Tier | Models in this band | Role | Given | Never given |
|---|---|---|---|---|
| **T1 — Executor** | ZCode **GLM 5.2**; comparable open-weight coding models | Applies a fully-specified change | A **Build Card** (§5): exact files, exact edits, exact commands | Goals, trade-offs, "figure out the best way", raw GitHub issues |
| **T2 — Implementer** | **Claude Sonnet 5**; GLM 5.2 at high effort on familiar ground | Implements a spec within one bounded module | An `AC-N`/`NG-N` issue + a named file set | Schema, auth, crypto, cross-module refactors |
| **T3 — Architect / Reviewer** | **Claude Fable 5**, **Claude Opus 5**, **ChatGPT 5.6**, **Kimi K2.5** | Designs, specs, reviews, and does dangerous work itself | Goals and constraints | — |

Sonnet 5 is genuinely T3-capable for well-scoped work; it sits at T2 by default only so that
architecture, schema and secret-handling decisions concentrate in one band. Promote a specific
Sonnet 5 task to T3 deliberately, not by drift.

**T3 must do three things and may not delegate them:** author Build Cards, review every
PR, and personally implement anything in the T3-only list (§3).

### Cross-model review — use the fact that you have four frontier models

The reviewer must never be the builder's model **or** the builder's session: a 35.7%
self-verification failure rate means the check cannot live inside the agent being checked.
With four T3 models available, satisfy that structurally — and prefer **crossing vendors**,
because different training lineages fail differently, so an error one model is blind to is
more likely to be visible to another.

| Built by | Review with |
|---|---|
| Fable 5 | Opus 5, ChatGPT 5.6, or Kimi K2.5 |
| Opus 5 | Fable 5, ChatGPT 5.6, or Kimi K2.5 |
| ChatGPT 5.6 | any Claude, or Kimi K2.5 |
| Kimi K2.5 | any Claude, or ChatGPT 5.6 |
| Sonnet 5 (T2) | any T3 model |
| GLM 5.2 (T1) | any T3 model |

Same-family review (Opus 5 reviewing Fable 5) is acceptable and still satisfies the
different-session rule. Same-model review is not.

**For the highest-risk T3 items** — the schema rebuild, the publish/slug-ownership model, the
credential lifecycle, anything touching secrets — run **two independent T3 reviews from
different vendors** and require both. Those are the changes where a plausible-looking wrong
implementation writes irreversibly to a client's production WordPress or drops rows in a
migration you cannot roll back.

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

| Skill | Tier | Status |
|---|---|---|
| `finn-spec` | **T3 only** | Must emit a Build Card for `[T1]` issues, stamp the tier in the title, and refuse to file without all nine sections |
| **`finn-build-t1`** | **T1** | ✅ **Written** — `.zcode/skills/finn-build-t1/SKILL.md`. Refuses uncarded issues, verifies the anchor before editing, forbids exploration, captures exit codes, five-heading PR body |
| `finn-build` | T2 | Unchanged for T2. **Do not run it on a GLM-class model** — use `finn-build-t1` |
| `finn-review` | **T3 only** | Evidence gate first, then scope, then invariants, then correctness. Blocks on only the four grounds above |

**Which skill to run:**

```
GLM 5.2 / open-weight               →  /finn-build-t1   (carded [T1] issues only)
Sonnet 5                            →  /finn-build      ([T2] issues)
Fable 5 / Opus 5 / ChatGPT 5.6 /
  Kimi K2.5                         →  /finn-spec, /finn-review, T3 implementation
```

**Stamp the tier in the issue title** — `[T1]`, `[T2]`, `[T3]`. `finn-build-t1` picks only
`[T1]`; `finn-build` picks only `[T2]`. An unstamped issue is not pickable by any builder,
which is the safe default.

**Unresolved contradiction, flagged for the owner:** `AGENTS.md:35` and `:134` forbid
agents from merging; `AGENTS.md:62-83` and `finn-build` §0a authorise auto-merge. Until
that is settled, **T1 and T2 must never merge.** If auto-merge stays, it belongs to T3
only, gated on a T3 review.

---

## 11. One-line summary per tier

- **T1 (GLM 5.2):** *Execute the card exactly. Change nothing else. If anything surprises
  you, stop and say so. Never claim a check you did not run.*
- **T2:** *Implement the spec inside the named files. Copy existing patterns. Do not widen
  scope or change contracts.*
- **T3 (Fable, Kimi):** *Decide everything. Card the work so precisely that a weak model
  cannot drift. Review evidence before code. Keep the dangerous work yourself.*
