# State of the Build — audit, 28 July 2026

> A dated, honest snapshot of where the code actually is against
> [`NORTH-STAR.md`](./NORTH-STAR.md). Update it when reality changes.
> Findings were verified by reading the code and by running the live app —
> not from commit messages.

---

## Headline

**Roughly twenty features exist. The core promise — form in, live site out — does not
work end to end.** Not because of small bugs, but because three structural pieces are
missing or wrong. Everything else is built around a spine that isn't connected.

In three days the loop shipped 48 commits across ~93 issues. The build engine works.
What was missing was a definition of *what* to build, so it built breadth: portal,
teams, branding, analytics, email, health, SSO, Plesk — each shallow, none joined into
a working line. CI only runs `tsc --noEmit` and `next build`, so "it compiles" was the
only quality gate any of it had to pass.

---

## The three structural breaks

These block the Golden Path. Nothing downstream matters until they are fixed.

### 1. There is no intake. Golden Path step 1 does not exist.

No public form. `middleware.ts` whitelists six public paths and none of them accept a
lead. `/onboard` looks like client intake but is a WordPress-connection wizard — and it
**discards the contact name and email it collects** (`app/onboard/page.tsx:27-29`). All
business information is typed in by an operator, twice, in two different places.

### 2. Projects can never reach clients. The portal is permanently empty.

`assignProjectToClient()` exists at `lib/db.ts:1026` and **is called from nowhere** —
grep finds only its own definition. `sites.client_id` is therefore always `NULL`, so:

- every client portal shows *"No website assigned yet"*, forever;
- `listProjectsForClient()` always returns `[]`;
- change requests need a project id from that empty list, so the client can never file one;
- the `/requests` operator queue is unreachable by construction.

The portal, the change-request loop and the review cycle are all real, working code
sitting behind a switch that was never wired.

Worse, `regenerateProject()` (`lib/db.ts:343-357`) drops `client_id`,
`wp_connection_id` and `wp_page_ids` when it creates a version. So even after wiring
the switch, the first AI edit or regeneration silently unassigns the client *and*
redirects future pushes to the legacy global connection — one client's content pushed
to whatever site is in the singleton settings row.

### 3. WordPress delivery pushes a format WordPress cannot render.

Generation produces a complete standalone `<!doctype html>…</html>` document per page
with an inline `<style>` block. `push-wp/route.ts:127-131` puts that whole document
into the WP REST `content` field.

WordPress strips `<html>`, `<head>` and (without `unfiltered_html`) `<style>`. What
survives is unstyled markup nested inside the active theme's own document — duplicate
headers and footers, colliding CSS. Navigation hrefs are `index.html`, `services.html`,
which are 404s on WordPress permalinks. Images are random `picsum.photos` hotlinks that
are never uploaded. **There is no media upload code at all** — no `/wp/v2/media` call
anywhere in `lib/`.

"Pushed to WordPress" currently does not mean "a working website."

---

## What the generated sites actually look like

Measured from the live database, not inferred:

| Page | Bytes | `<section>`s | Images | `@media` | Schema | Meta desc |
|---|---|---|---|---|---|---|
| home (p1) | 3,756 | 3 | 1 | ✗ | ✗ | ✗ |
| home (p2) | 4,053 | 3 | 1 | ✗ | ✗ | ✗ |
| services | 2,725 | 3 | 1 | ✗ | ✗ | ✗ |
| gallery | 2,819 | 1 | 7 | ✗ | ✗ | ✗ |
| contact | 3,969 | 3 | 1 | ✗ | ✗ | ✗ |
| about | 3,735 | 3 | 1 | ✗ | ✗ | ✗ |

A real marketing homepage is 15–40 KB with 6–10 sections. **Not one page contains a
single media query** — nothing is responsive. No structured data, no meta descriptions,
no JS.

**Why:** five sequential `gpt-4o-mini` calls at temperature 0.7, one per page, each with
no knowledge of the others (`lib/generate.ts:41-52`). The only thing shared across pages
is seven CSS variables. Header, footer, layout, spacing and button styling are
re-invented independently on every call. There is no validation of the output — no parse
check, no truncation check, no retry, no tests anywhere in the repo.

For contrast, the Hostinger AI builder pages already on the client's server run
13–27 KB of proper `wp-block-*` Gutenberg markup with layout constraints and animation
classes. That is the standard our output is being compared against, and it is the
format [`NORTH-STAR.md §6`](./NORTH-STAR.md) targets.

---

## Feature fit against the Golden Path

| Built | Golden Path step | Verdict |
|---|---|---|
| Public intake form | 1. Capture | 🔴 **Does not exist** |
| `/onboard` wizard | — | 🟠 Mislabelled; it's a WP-connection wizard, drops its contact fields |
| Brief → plan | 3. Plan | 🔴 Does not exist. No planning step, no template matching, no human gate |
| Template library | 3. Plan | 🟠 Real, four intake paths work — but templates are frozen HTML, and **guided delivery is silently broken**: `lib/template-deliver.ts:136` passes `theme.id` (`"template"`), which isn't in the themes array, so every guided delivery falls back to plain "minimal" and discards the template's palette, fonts and voice |
| 5-page generator | 4. Build | 🟠 Works, but see quality table above. Wrong architecture for the target |
| NL editing | 5. Review | 🟠 Real, with preview and versioning — but regenerates whole pages, so unrelated markup silently changes. Bulk apply runs on all 5 pages with **no preview and no review**, then can push live |
| Review / approval gate | 5. Review | 🔴 Does not exist. No approval state, no client preview link |
| Plesk provisioning | 6. Provision | 🟠 Domain creation works. **WP install fails open** — `lib/plesk.ts:154-156` has an empty catch and returns a fake success object, so the UI reports "✓ WordPress provisioned!" when nothing was installed. Generated admin and FTP passwords are discarded. No SSL, no DNS |
| Hostinger provisioning | 6. Provision | 🔴 Does not exist |
| WP pairing + credential verify | 6. Provision | 🟢 Works well, and now verifies credentials before registering |
| WP SSO, health, settings sync | 8. Handoff | 🟢 Real and working |
| WP page push | 7. Deliver | 🔴 Pushes an unrenderable format. Drafts only — no publish, no front-page setting |
| Media upload to WP | 7. Deliver | 🔴 Does not exist |
| Elementor / Beaver targets | 7. Deliver | 🔴 Does not exist |
| Client portal | 8. Handoff | 🟠 Real code, permanently empty (break #2) |
| Change requests | 8. Handoff | 🟠 Real code, unreachable (break #2) |
| Client↔project assignment | spine | 🔴 **Dead code** |
| Exports (ZIP / single HTML) | — | 🟢 The only delivery path that produces a correct result |
| Multi-operator teams | — | 🟠 Shipped, but `editor`/`viewer` roles are **decorative** — see security |
| Branding, analytics, email | — | 🟢 Work. Off the Golden Path; do not extend for now |

---

## Broken but reports success

The most dangerous category — these look fine to an operator:

1. **Plesk WP install** — empty catch, fake success object, UI says provisioned.
2. **Guided template delivery** — theme silently discarded, generic site delivered.
3. **Change-request apply** — per-page edit failures fall back to the original page and
   still report full success; push failures are swallowed by an empty catch; the client
   is emailed "completed" regardless.
4. **Push after regenerate** — with `wp_connection_id` lost, pages go to the legacy
   global connection instead of the client's site.
5. **`savePleskSettings` and `saveEmailSettings`** — bare `UPDATE … WHERE id = 1` with no
   upsert. On a fresh database the row doesn't exist, so settings appear to save and
   vanish.
6. **Logo URLs in every export and push** — stored as relative `/api/uploads/…`, so the
   logo is broken in every downloaded ZIP and every WordPress page.
7. **`home.html` navigation links** in template-delivered exports — the exporter writes
   `index.html`, so Home 404s.

Invariant 4 in the north star exists because of this list.

---

## Security and data issues

| Issue | Where | Severity |
|---|---|---|
| Pairing debug log writes **plaintext WordPress Application Passwords to disk** on a public unauthenticated endpoint | `app/api/wp/pairing/register/route.ts:32-40`, `data/pairing-debug.log` | 🔴 Remove before commit |
| `verifySessionRole` **defaults to admin** when a token has no role claim | `lib/auth.ts:110` | 🔴 Highest privilege is the fallback |
| `editor` / `viewer` roles are **not enforced anywhere** except operator CRUD. A "viewer" can generate, delete, provision Plesk, and read the OpenAI key and Plesk password | ~50 routes | 🔴 UI promises read-only; server grants full write |
| All secrets stored in plaintext: WP app passwords, health secrets, OpenAI key, SMTP password, **Plesk control-panel password** | `lib/db.ts` | 🔴 |
| Session cookies lack `Secure`; deployment is plain HTTP by design | `lib/auth.ts:62,72,85` | 🟠 |
| No session revocation — a deleted operator's JWT stays valid up to 7 days | `lib/auth.ts` | 🟠 |
| No rate limiting or lockout on any login route; 6-char minimum password | `app/api/operators/route.ts:48` | 🟠 |
| No indexes on any table; `listProjects` runs a correlated subquery (O(n²)) on every dashboard load | `lib/db.ts:376-382` | 🟠 |
| `deleteWpConnection` leaves dangling `sites.wp_connection_id`; `deleteProject` orphans change requests | `lib/db.ts:633,402` | 🟡 |
| Unbounded growth, no retention: `activity_log`, `wp_login_tokens`, `wp_pairing_codes` | | 🟡 |

---

## Decisions needed from you

These are contradictions the code and docs cannot resolve on their own.

1. ~~**Merge authority.**~~ ✅ **Resolved.** No LLM merges; GitHub does, gated on the
   `finn-gate` required check. `finn-build` (which ran `gh pr merge` from the builder) was
   deleted, and the contradictory `AGENTS.md` sections were replaced with a single
   "Merge policy". See [`AGENT-TIERS.md`](./AGENT-TIERS.md) "Merge authority — resolved".
2. ~~**Retire the dead carve-out.**~~ ✅ **Resolved.** The `agent-ready` self-labelling
   carve-out for issues #15–#18 was deleted from `AGENTS.md`. No agent may apply that label.
3. **Retire the stale non-goals.** "Single-operator", "localhost only", "no encryption
   at rest" (`lib/auth.ts:15`, `lib/db.ts:82-83`) were invalidated by the client portal,
   multi-operator teams and internet-facing Plesk provisioning — but never formally
   withdrawn, so agents still cite them as binding. We need a stated way to retire a
   non-goal.
4. **Scale posture.** SQLite with a synchronous in-process driver, no WAL, no indexes,
   one container, no backups. Fine for one operator on one box; it cannot scale
   horizontally and every query blocks the event loop. Decide now whether the target is
   single-box (keep SQLite, add WAL + indexes) or multi-tenant SaaS (move to Postgres
   before the schema grows further).
5. **`README.md:43-44`** claims the builder cron is registered and the reviewer isn't.
   A session plan recorded that neither exists. The README is still wrong.

---

## The shortest path back to a working line

In order. Each is small; together they connect the spine.

1. Delete the pairing debug log. It is writing credentials to disk.
2. Add `PATCH /api/projects/[id]/client` calling the existing `assignProjectToClient`,
   plus a picker on the project page. This alone activates the portal, change requests
   and `/requests`.
3. Make `regenerateProject` carry `client_id`, `wp_connection_id` and `wp_page_ids`
   forward — otherwise step 2 regresses on the first edit.
4. Make Plesk WP install throw on failure instead of faking success, and return the
   generated admin credentials.
5. Fix guided template delivery to pass the synthesized theme, not `theme.id`.

Then start Phase 1 in [`../ROADMAP.md`](../ROADMAP.md) — the SiteModel rebuild — rather
than adding more features on the current generator.
