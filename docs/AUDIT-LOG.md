# Audit Log

Append-only record of `/finn-audit` checkpoints. Never edit a previous entry — correcting
history here would be the same "declare yourself done" failure mode a mutable marker (a git
tag) would invite. See [`../.zcode/skills/finn-audit/SKILL.md`](../.zcode/skills/finn-audit/SKILL.md)
for what an audit actually checks.

The **Head SHA** of the latest entry is the starting point for the next audit's diff range.

---

## Audit 0 — 2026-07-28 (baseline, no review performed)

**Base SHA:** `d752a1d` (repo start)
**Head SHA:** `3be5f0c5382d13da0ed0855d8b72f9660643ddb7`
**PRs in range:** all of #1–#112 (112 total)

This entry is a **baseline marker, not a completed audit.** Everything up to this point was
built and reviewed under the tiered pipeline described in `docs/PIPELINE.md` and
`docs/AGENT-TIERS.md`, but no Kimi/Opus checkpoint audit has run against any of it yet.

### Findings

Not evaluated — this entry exists only to give Audit 1 a starting SHA. The first real audit
should treat everything since repo start as in scope, though in practice most of it (#1–#93)
predates the tiered pipeline and `docs/GAP-LEDGER.md` entirely; focus review effort on what
shipped after the audit found 162 defects (#94 onward), since that is the work the tiered
pipeline is actually responsible for.

### Fixed directly

None.

### Filed for later

None — see instead the open backlog at the time of this baseline: #96, #97 (`tier:t2`),
#103, #104, #107, #109 (`tier:t3`/lint), plus #115 (roadmap sync, held for human merge).

### Pipeline drift

**Known, already root-caused:** `ROADMAP.md`'s Phase 0 checklist was not updated as items
merged (#108's Node pinning shipped with the box still unchecked), which caused a `/finn-t3`
backlog-refill pass to re-spec already-finished work as issue #114. Fixed in PR #115
(pending human merge at the time of this entry). The first real audit should confirm #115
landed and the checklist stayed in sync since.
