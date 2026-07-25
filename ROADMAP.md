# Roadmap — AI Website Generator SaaS

Each issue is one Finn-loop build cycle. Issues must be merged in order
(each builds on the merged code of the ones before it).

## Phase 1 — Core (DONE)
- [x] **#1** — Core loop: info in → 5-page site out (preview + ZIP)

## Phase 2 — Persistence & dashboard
- [ ] **#3** — Save generated sites to local SQLite database
- [ ] **#4** — Saved-sites dashboard: list, view, delete, re-download
- [ ] **#5** — Admin login (single-user, hashed password, session cookie)

## Phase 3 — Multi-client
- [ ] **#6** — Clients CRUD (name, contact, notes)
- [ ] **#7** — Attach a generated site to a client
- [ ] **#8** — Client list view with their sites

## Phase 4 — Templates
- [ ] **#9** — Template gallery (curated starting points)
- [ ] **#10** — Start a new site from a template
- [ ] **#11** — Screenshot → new template (LLM vision) *[hard]*

## Phase 5 — Delivery
- [ ] **#12** — SMTP email configuration & test send
- [ ] **#13** — Deploy to VPS (Docker compose)
- [ ] **#14** — WordPress export (HTML → WP import format) *[hard]*

## Phase 6 — Polish
- [ ] **#15** — Site health & plugin-update dashboard (WP-connected) *[hard]*
- [ ] **#16** — Elementor integration *[hard]*
- [ ] **#17** — Beaver Builder integration *[hard]*

## Notes
- Hard issues may be split into chains when specced.
- Branch protection requires the `build` CI check on every PR.
- Auto-merge is authorized: any PR that is `loop-approved` + CI green +
  mergeable gets merged by the builder loop.
