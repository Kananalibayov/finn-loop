// Production env loader for the Docker standalone server.
// Next.js loads .env automatically in `next dev`, but the standalone production
// server (output: "standalone") does NOT — environment must come from the real
// process env. This preload loads /app/.env (mounted read-only by compose) into
// process.env before server.js starts, so secrets like ADMIN_PASSWORD_HASH /
// ADMIN_SESSION_SECRET / OPENAI_API_KEY / DATABASE_FILE reach the app.
//
// Usage in Dockerfile:
//   CMD ["node", "--require", "./docker-entrypoint.js", "server.js"]
//
// Uses @next/env (already a transitive dep of next) so the parsing rules match
// what `next dev` uses, including \$ -> $ escape handling for bcrypt hashes.

const { loadEnvConfig } = require("@next/env");
const path = require("path");

try {
  loadEnvConfig(path.resolve(__dirname));
  console.log("[docker-entrypoint] .env loaded; ADMIN_PASSWORD_HASH len=" +
    (process.env.ADMIN_PASSWORD_HASH || "").length);
} catch (e) {
  // If .env is missing or unparseable, log and continue — the app will fail
  // loudly on the specific missing var (e.g. ADMIN_SESSION_SECRET throws in
  // lib/auth.ts), which is a clearer error than a crash here.
  console.error("[docker-entrypoint] Failed to load .env:", e.message);
}

require("./server.js");
