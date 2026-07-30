# BUILD LOG

One dated line per merged PR, in plain English a non-programmer can read. Append-only.

- 2026-07-30 — #207: four website sections (pricing tables, statistics, logo rows, and
  step-by-step guides) are now available as vetted building blocks for generated sites.
  Shipped as one combined PR because the four separate PRs kept colliding on the same
  file.
- 2026-07-30 — #208: the FAQ section (collapsible questions, or a plain expanded list)
  joined the building blocks. With this, all 14 planned section types exist.
- 2026-07-30 — #209: every generated page now has a real header (business name
  linked to the homepage, plus navigation) and a footer, using the semantic
  landmarks screen readers and search engines expect.
- 2026-07-30 — #206: generated sites are no longer unstyled black-on-white
  text. They now ship one real stylesheet built from the site's design tokens:
  a modern base layer (fluid type, proper focus rings, reduced-motion support,
  tap targets big enough for thumbs) plus the hero section's own styles.
  Verified with real browser screenshots at desktop and phone widths.
- 2026-07-30 — #211: generated sites now pass through eight automatic quality
  gates before anything can be called deliverable: one headline per page,
  proper page landmarks, unique titles and descriptions, working internal
  links, no leftover placeholder text, alt text on every image, no smuggled
  inline styling, and proof that no section was silently dropped or duplicated
  in rendering. A failure lists every problem at once, in plain language
  naming the page, so it can be fixed in one pass instead of trial and error.
- 2026-07-30 — #213: fixed a crash in the merge gate that was wrongly blocking
  documentation-only changes; docs updates now pass through the same safety
  checks as code.
- 2026-07-30 — #214: recorded the reasoning behind the new website quality
  gates in the project's decision log, so future changes know why each rule
  exists.
- 2026-07-30 — #215: when branding, email, or hosting settings fail to load,
  the settings page now shows them read-only with a Retry button instead of an
  empty form that could have wiped the real settings if saved.
- 2026-07-30 — #217: the roadmap now plans a ground-up rebuild of how sites are
  stored, replacing a planned patch-up that would have been thrown away.
- 2026-07-30 — #218: the services, features, and about sections of generated
  websites are now properly styled (6 designs), under rules that keep every
  section's look driven by the site's design choices and readable on any
  screen size.
- 2026-07-30 — #220: customer quotes, step-by-step guides, and image galleries
  joined the styled set (6 more designs), including a timeline with a
  connecting line and a magazine-style mixed-height gallery.
- 2026-07-30 — #222: pricing cards and comparison tables, key numbers, and
  logo rows are styled (6 more designs). Checking real browser screenshots
  caught a pricing table that broke on phone-width screens; it was fixed
  before release.
- 2026-07-30 — #224: a new preview page lets the operator see what the rebuilt
  website pipeline produces before the AI writer is connected to it. It proves
  the pages render correctly; it does not yet prove AI-written content.
- 2026-07-30 — #226: team sections, FAQs, call-to-action blocks, and contact
  forms are styled (the final 8 designs). Every one of the 28 website sections
  now ships with a real stylesheet — none are left unstyled.
- 2026-07-30 — #227: the roadmap now records the owner's standing decision
  that the builder may also make product-design choices, provided each one is
  written down in the roadmap and decision log for after-the-fact review.
- 2026-07-30 — #232: the app's database now runs in WAL mode with a busy
  timeout, so simultaneous reads and writes stop tripping over each other.
- 2026-07-30 — #236: sites can now have a version history — every saved
  version of a site is stored immutably and validated, with the project
  pointing at its current version. Older projects are untouched and keep
  working exactly as before.
- 2026-07-30 — the project screen now shows that version history: a Versions
  card lists each saved version (newest first, the current one marked), and
  older projects without versions say so honestly instead of pretending.
