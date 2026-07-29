#!/usr/bin/env bash
# ci/backup-restore-smoke.sh — round-trip proof that backup-db.sh produces a
# restorable database.
#
# In a clean checkout this script:
#   1. Creates throwaway (non-secret) Compose configuration for the prod stack
#   2. Builds and boots it, waiting for /api/health
#   3. Inserts a deterministic marker row into `sites` via the running app
#   4. Records the source row count
#   5. Invokes scripts/backup-db.sh to take an online backup
#   6. Tears down the original Compose project + volume
#   7. Creates a fresh app service/volume, copies the backup into /app/data/app.db
#      BEFORE first start
#   8. Boots the fresh stack and asserts the restored marker row count exactly
#      equals the source count
#
# Prints SOURCE_ROWS=<n>, RESTORED_ROWS=<n>, RESTORE_VERIFIED=1 on success.
#
# AC-2: if the copied backup is deleted/corrupted before restore, exits non-zero
# and never prints RESTORE_VERIFIED=1.
#
# Cleanup runs on success AND failure via a trap, without masking the original
# exit status (issue #131 Constraint 6). Throwaway data only — never production.

set -euo pipefail

# --- Configuration -----------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$REPO_ROOT"

PROJECT_NAME="backup-restore-test"
THROWAWAY_DIR="${REPO_ROOT}/.backup-restore-throwaway"
HOST_BACKUP_DIR="${THROWAWAY_DIR}/backups"
SMOKE_COMPOSE="${THROWAWAY_DIR}/docker-compose.smoke.yml"

# Throwaway, non-secret credentials. Never reuse anywhere real.
ADMIN_HASH="$(node -e "console.log(require('bcryptjs').hashSync('ci-throwaway-backup', 10))")"
SESSION_SECRET="ci-throwaway-session-secret-0123456789abcdef"
MARKER_NAME="__BACKUP_RESTORE_PROBE__"

mkdir -p "$THROWAWAY_DIR" "$HOST_BACKUP_DIR"

# Marker row is inserted via a direct better-sqlite3 insert inside the
# container (not the app's HTTP API) so the schema is always correct regardless
# of future migrations. The app itself is never asked to create this row.
INSERT_MARKER_JS="
const Database = require('better-sqlite3');
const db = new Database('/app/data/app.db');
db.prepare(\`INSERT INTO sites (business_name, tagline, theme_id, mode, input_json, pages_json, created_at)
            VALUES (?, '', 'warm', 'full', '{}', '[]', datetime('now'))\`).run('${MARKER_NAME}');
const { n } = db.prepare('SELECT COUNT(*) AS n FROM sites').get();
console.log('ROWS=' + n);
db.close();
"

COUNT_MARKER_JS="
const Database = require('better-sqlite3');
try {
  const db = new Database('/app/data/app.db', { readonly: true });
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM sites WHERE business_name = ?').get('${MARKER_NAME}');
  console.log('MARKER_ROWS=' + n);
  db.close();
} catch (e) {
  console.log('MARKER_ROWS=0');
  console.error(e.message);
}
"

# --- Cleanup trap (runs on every exit, preserves original status) -----------
CLEANUP_RAN=0
cleanup() {
  local exit_code=$?
  if [ "$CLEANUP_RAN" = "1" ]; then exit "$exit_code"; fi
  CLEANUP_RAN=1
  # Tear down the test project + its volumes. -v removes named volumes.
  docker compose -p "$PROJECT_NAME" -f "$SMOKE_COMPOSE" down -v --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$THROWAWAY_DIR"
  exit "$exit_code"
}
trap cleanup EXIT

# --- Throwaway Compose file --------------------------------------------------
# Mirrors the real docker-compose.yml but with no .env mount (creds are inline,
# throwaway) and a project-prefixed volume so cleanup is deterministic.
cat > "$SMOKE_COMPOSE" <<EOF
services:
  app:
    build:
      context: ${REPO_ROOT}
    image: backup-restore-test:latest
    container_name: ${PROJECT_NAME}-app
    environment:
      ADMIN_PASSWORD_HASH: ${ADMIN_HASH}
      ADMIN_SESSION_SECRET: ${SESSION_SECRET}
      OPENAI_API_KEY: sk-ci-throwaway
      OPENAI_BASE_URL: http://openai-mock:4010/v1
      DATABASE_FILE: /app/data/app.db
    ports:
      - "3000:3000"
    volumes:
      - app-data:/app/data
    depends_on:
      - openai-mock
  openai-mock:
    image: node:22-alpine
    volumes:
      - ${REPO_ROOT}/ci:/ci:ro
    command: ["node", "/ci/openai-mock.mjs"]
volumes:
  app-data:
EOF

# Export Compose project context so scripts/backup-db.sh (which uses plain
# `docker compose` with no -p/-f flags, per its documented production usage)
# resolves THIS throwaway project, not the default cwd-based one. Without this,
# backup-db.sh's `docker compose ps app` fail-closed check exits 1 because the
# default project has no `app` service. (Review feedback on PR #138.)
# The smoke's own calls still pass -p/-f explicitly, which is harmless when the
# env vars agree. Production usage of backup-db.sh (run from repo root against
# docker-compose.yml, per DEPLOY.md) is unaffected — it has no exporter.
export COMPOSE_PROJECT_NAME="$PROJECT_NAME"
export COMPOSE_FILE="$SMOKE_COMPOSE"

# --- Step 1-2: build + boot, wait for health --------------------------------
echo "SMOKE building + booting throwaway stack (project=${PROJECT_NAME})"
docker compose -p "$PROJECT_NAME" -f "$SMOKE_COMPOSE" up -d --build >/dev/null

echo "SMOKE waiting for /api/health"
DEADLINE=$(( $(date +%s) + 180 ))
until curl -sf http://localhost:3000/api/health >/dev/null 2>&1; do
  if [ "$(date +%s)" -ge "$DEADLINE" ]; then
    echo "FAIL: app did not become healthy within 180s" >&2
    exit 1
  fi
  sleep 2
done

# --- Step 2b: bootstrap the schema via the real app path --------------------
# /api/health uses a direct better-sqlite3 connection and deliberately does NOT
# trigger lib/db's lazy schema creation (issue #103/#117 design). So a fresh
# volume has an empty app.db with no `sites` table, and the direct marker
# insert below would fail with "no such table: sites" (review feedback #138).
# Hitting POST /api/operators/login with the throwaway admin password calls
# getAppSettings() → db() → CREATE TABLE IF NOT EXISTS for every table. This
# exercises the app's real schema-init path, not a synthetic one.
echo "SMOKE bootstrapping schema via POST /api/operators/login"
LOGIN_HTTP="$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/operators/login \
  -H "Content-Type: application/json" \
  -d '{"password":"ci-throwaway-backup"}')"
if [ "$LOGIN_HTTP" != "200" ]; then
  echo "FAIL: schema-bootstrap login returned HTTP ${LOGIN_HTTP} (expected 200)" >&2
  exit 1
fi

# --- Step 3-4: insert marker + record source row count ----------------------
echo "SMOKE inserting marker row + recording source count"
docker compose -p "$PROJECT_NAME" -f "$SMOKE_COMPOSE" exec -T app node -e "$INSERT_MARKER_JS"
SOURCE_ROWS="$(docker compose -p "$PROJECT_NAME" -f "$SMOKE_COMPOSE" exec -T app node -e "$COUNT_MARKER_JS" | grep -oE 'MARKER_ROWS=[0-9]+' | grep -oE '[0-9]+')"
echo "SOURCE_ROWS=${SOURCE_ROWS}"
if [ -z "$SOURCE_ROWS" ] || [ "$SOURCE_ROWS" = "0" ]; then
  echo "FAIL: marker insert did not produce a non-zero source count" >&2
  exit 1
fi

# --- Step 5: take the backup via scripts/backup-db.sh -----------------------
echo "SMOKE taking online backup"
BACKUP_OUT="$(bash "${REPO_ROOT}/scripts/backup-db.sh" "$HOST_BACKUP_DIR" 2>&1)" || {
  echo "FAIL: backup-db.sh failed:" >&2; echo "$BACKUP_OUT" >&2; exit 1;
}
echo "$BACKUP_OUT" | grep -q "PRAGMA_INTEGRITY=ok" || {
  echo "FAIL: backup did not report PRAGMA_INTEGRITY=ok" >&2; echo "$BACKUP_OUT" >&2; exit 1;
}
BACKUP_PATH="$(echo "$BACKUP_OUT" | grep -oE 'BACKUP_PATH=.*' | cut -d= -f2-)"
if [ -z "$BACKUP_PATH" ] || [ ! -f "$BACKUP_PATH" ]; then
  echo "FAIL: backup file not found at ${BACKUP_PATH}" >&2
  exit 1
fi
echo "SMOKE backup verified at ${BACKUP_PATH}"

# --- Step 6: tear down the original stack + volume --------------------------
echo "SMOKE tearing down original stack + volume"
docker compose -p "$PROJECT_NAME" -f "$SMOKE_COMPOSE" down -v --remove-orphans >/dev/null

# --- Step 7: fresh stack, copy backup in BEFORE first start -----------------
echo "SMOKE booting fresh stack with restored DB"
# Build first (volume is empty), but do NOT start app yet — we need to seed the
# backup into the new volume before the app's first start (issue #131 step 2).
docker compose -p "$PROJECT_NAME" -f "$SMOKE_COMPOSE" build >/dev/null

# Create the volume + a one-shot alpine container to drop the backup into it.
docker volume create "${PROJECT_NAME}_app-data" >/dev/null
docker run --rm -v "${PROJECT_NAME}_app-data:/data" -v "${BACKUP_PATH}:/backup.db:ro" alpine \
  sh -c "cp /backup.db /data/app.db && chmod 644 /data/app.db" >/dev/null

# Now boot. The app sees the restored DB on first start.
docker compose -p "$PROJECT_NAME" -f "$SMOKE_COMPOSE" up -d >/dev/null

echo "SMOKE waiting for restored /api/health"
DEADLINE=$(( $(date +%s) + 180 ))
until curl -sf http://localhost:3000/api/health >/dev/null 2>&1; do
  if [ "$(date +%s)" -ge "$DEADLINE" ]; then
    echo "FAIL: restored app did not become healthy within 180s" >&2
    exit 1
  fi
  sleep 2
done

# --- Step 8: assert restored marker count equals source ---------------------
RESTORED_ROWS="$(docker compose -p "$PROJECT_NAME" -f "$SMOKE_COMPOSE" exec -T app node -e "$COUNT_MARKER_JS" | grep -oE 'MARKER_ROWS=[0-9]+' | grep -oE '[0-9]+')"
echo "RESTORED_ROWS=${RESTORED_ROWS}"

if [ "$RESTORED_ROWS" != "$SOURCE_ROWS" ]; then
  echo "FAIL: restored marker count (${RESTORED_ROWS}) != source (${SOURCE_ROWS})" >&2
  exit 1
fi

echo "RESTORE_VERIFIED=1"
echo "SMOKE backup-restore round-trip verified"
