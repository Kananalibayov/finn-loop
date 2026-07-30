/**
 * The modern-CSS base layer shared by every generated site. Token-driven only:
 * no literal colours, no magic font sizes. The `24px` minimums are WCAG 2.2's
 * own target-size value, and `2px`/`1px` appear only as outline/border widths.
 * Logical properties throughout; container queries (not viewport media) are the
 * section-level responsive strategy — `@media` appears here only for genuinely
 * page-level concerns (reduced motion).
 */
export const BASE_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; }

img { max-width: 100%; height: auto; display: block; }

body {
  font-family: var(--font-body);
  color: var(--color-text);
  background: var(--color-bg);
  line-height: 1.5;
  -webkit-text-size-adjust: 100%;
}

h1, h2, h3, h4 {
  font-family: var(--font-heading);
  line-height: 1.15;
  text-wrap: balance;
}
h1 { font-size: var(--step-4); }
h2 { font-size: var(--step-3); }
h3 { font-size: var(--step-2); }
h4 { font-size: var(--step-1); }

p { text-wrap: pretty; max-inline-size: 70ch; }

a { color: var(--color-primary); }
a, button { min-height: 24px; min-width: 24px; }

:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }

.section { padding-block: var(--space-5); padding-inline: var(--space-3); }
.section > * { max-inline-size: var(--container-max); margin-inline: auto; }
.section > * + * { margin-block-start: var(--space-3); }

.site-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  max-inline-size: var(--container-max);
  margin-inline: auto;
  padding-block: var(--space-2);
  padding-inline: var(--space-3);
}
.site-brand {
  font-family: var(--font-heading);
  font-size: var(--step-1);
  font-weight: 700;
  color: var(--color-text);
  text-decoration: none;
}
.site-nav { display: flex; flex-wrap: wrap; gap: var(--space-3); }
.site-nav a { color: var(--color-text); text-decoration: none; }
.site-nav a:hover { color: var(--color-primary); }
.site-footer {
  max-inline-size: var(--container-max);
  margin-inline: auto;
  padding-block: var(--space-4);
  padding-inline: var(--space-3);
  color: var(--color-muted);
  border-block-start: 1px solid var(--color-border);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
`.trim();
