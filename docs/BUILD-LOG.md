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
