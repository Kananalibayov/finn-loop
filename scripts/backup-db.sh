#!/usr/bin/env bash
# scripts/backup-db.sh — online SQLite backup of the running app's database.
#
# Creates a hot backup of /app/data/app.db inside the `app` Compose service using
# better-sqlite3's Database#backup() API (the online backup primitive — safe to
# run while the app is serving requests), verifies it with PRAGMA integrity_check,
# copies the backup to a host directory, and removes the temporary in-container
# copy. Prints the final host path and PRAGMA_INTEGRITY=ok on success.
#
# Usage:
#   scripts/backup-db.sh <host-destination-dir>
#
# Exit codes:
#   0 — backup created and verified
#   1 — misuse / missing args / app service not running / backup failed integrity
#
# This script addresses the running `app` service via `docker compose exec` /
# `docker compose cp` only. It does NOT assume the engine-level volume is named
# `app-data` (Compose prefixes project-scoped resources), and it never byte-copies
# the live app.db (Constraint 1 of issue #131).

set -euo pipefail

DEST_DIR="${1:-}"
if [ -z "$DEST_DIR" ]; then
  echo "Usage: $0 <host-destination-dir>" >&2
  exit 1
fi

# Fail closed if the app service isn't up — there's nothing to back up.
if ! docker compose ps app | grep -q "Up"; then
  echo "ERROR: the 'app' Compose service is not running. Start it with 'docker compose up -d' first." >&2
  exit 1
fi

mkdir -p "$DEST_DIR"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
IN_CONTAINER_BACKUP="/tmp/backup-${STAMP}.db"
DB_FILE="${DATABASE_FILE:-/app/data/app.db}"

# 1. Online backup via better-sqlite3 (already installed in the prod image).
#    Database#backup() returns a Promise<BackupMetadata> — it is the async
#    online-backup primitive. We MUST await it before closing the source or
#    opening the destination, otherwise we can inspect/copy a backup that has
#    not finished writing (review feedback on PR #138: the previous version
#    assigned the promise to `meta` synchronously and raced on completion).
docker compose exec -T app node -e "
const Database = require('better-sqlite3');
(async () => {
  const src = new Database('${DB_FILE}', { readonly: true, fileMustExist: true });
  const meta = await src.backup('${IN_CONTAINER_BACKUP}');
  src.close();
  const bak = new Database('${IN_CONTAINER_BACKUP}', { readonly: true });
  const integrity = bak.pragma('integrity_check', { simple: true });
  bak.close();
  if (String(integrity) !== 'ok') {
    console.error('INTEGRITY_FAIL: ' + integrity);
    process.exit(2);
  }
  console.log('BACKUP_OK pages=' + meta.totalPages + ' integrity=' + integrity);
})().catch((e) => { console.error('BACKUP_ERROR: ' + (e && e.message ? e.message : e)); process.exit(3); });
"

# 2. Copy the verified backup out of the container to the host destination.
HOST_PATH="${DEST_DIR}/app.db.${STAMP}"
docker compose cp app:"${IN_CONTAINER_BACKUP}" "${HOST_PATH}" >/dev/null

# 3. Remove only the temporary in-container backup. The live DB is untouched.
docker compose exec -T app rm -f "${IN_CONTAINER_BACKUP}"

# Restrict permissions — backups may contain credentials (issue #131 Constraint 4).
chmod 0600 "$HOST_PATH" 2>/dev/null || true

echo "BACKUP_PATH=${HOST_PATH}"
echo "PRAGMA_INTEGRITY=ok"
