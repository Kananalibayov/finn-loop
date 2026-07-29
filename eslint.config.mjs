import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// eslint-config-next@15.5.21 (pinned to match the installed Next.js version) only
// ships legacy eslintrc-style shareable configs ("extends": [...]), not a native
// flat-config array. FlatCompat is ESLint's own documented bridge for this case —
// see https://eslint.org/docs/latest/use/configure/migration-guide#using-eslintrc-configs-in-flat-config.
const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    // GAP-LEDGER pattern 1: "success is a returned shape, never an observed
    // effect" has had zero mechanical opposition until this issue (#109).
    rules: {
      "no-empty": ["error", { allowEmptyCatch: false }],
      "no-restricted-syntax": [
        "error",
        {
          selector: "CatchClause > BlockStatement[body.length=0]",
          message:
            "GAP-LEDGER pattern 1: empty catch swallows the error. Log it, rethrow it, or handle it.",
        },
        {
          // Non-empty catch that neither rethrows nor logs. :has() finds these
          // anywhere in the block's subtree, not just as a direct statement, so
          // an error logged/thrown from inside a nested if/for still counts.
          selector:
            "CatchClause > BlockStatement[body.length>0]:not(:has(ThrowStatement)):not(:has(CallExpression[callee.object.name=/^(console|logger)$/i])):not(:has(CallExpression[callee.name=/^(log|logError|logWarn)$/i]))",
          message:
            "GAP-LEDGER pattern 1: catch block neither logs nor rethrows the error — it is silently swallowed.",
        },
      ],
    },
  },
];

export default eslintConfig;
