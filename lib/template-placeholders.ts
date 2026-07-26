// AC-1 (issue #54): the placeholder tokens supported in frozen template HTML.
// DATA-ONLY module (no imports) so client components can safely import it
// without dragging in the server-only generation/DB chain via template-deliver.
// Keep in sync with substitutePlaceholders in lib/template-deliver.ts.

export const TEMPLATE_PLACEHOLDERS = [
  "{{businessName}}",
  "{{tagline}}",
  "{{phone}}",
  "{{email}}",
  "{{address}}",
  "{{services}}",
] as const;
