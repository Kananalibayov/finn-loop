# Deploy

Run the app on any Linux VPS with Docker installed. One command brings it up;
the SQLite database persists across restarts via a named volume.

## Prerequisites (one-time)

1. A Linux host (amd64) with **Docker** and the **Docker Compose plugin** (`docker compose v2+`) installed.
2. The repo checked out on the host (or at least `Dockerfile`, `docker-compose.yml`, `.dockerignore`, and the app source).

## First deploy

1. Copy the env template:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` and fill in the secrets (see the file's comments for how to generate each):
   - `OPENAI_API_KEY` — your OpenAI key
   - `ADMIN_PASSWORD_HASH` — bcrypt hash of your admin password (backslash-escape the `$`s as `\$`, since `@next/env` otherwise treats `$X` as a variable reference — e.g. `\$2b\$10\$...`)
   - `ADMIN_SESSION_SECRET` — random 32+ char string
   - `PORT` — host port (default `3000`)
3. Build and start:
   ```bash
   docker compose up -d --build
   ```
4. Confirm it's up:
   ```bash
   curl http://localhost:3000/login    # → HTTP 200
   ```
5. Open `http://<host>:<PORT>` in a browser, log in with your admin password, generate a site.

## Daily operation

**View logs:**
```bash
docker compose logs -f
```

**Stop:**
```bash
docker compose down
```

**Restart (DB persists):**
```bash
docker compose restart
```

## Updating to a new version

After pulling new code:
```bash
git pull
docker compose up -d --build
```
Compose rebuilds the image and recreates the container. The `app-data` volume is preserved, so previously-generated sites survive.

## Backups

The SQLite DB lives at `/app/data/app.db` inside the container (backed by the `app-data` named volume). To take an **online** backup (safe to run while the app is serving requests) from the host:

```bash
scripts/backup-db.sh ./backups
```

This uses `better-sqlite3`'s `Database#backup()` API through `docker compose exec`, runs `PRAGMA integrity_check` on the result, and copies the verified backup to the directory you pass. It prints the final host path and `PRAGMA_INTEGRITY=ok`. Never byte-copy the live `app.db` with a raw `cp` — it may capture a half-written page.

The procedure is tested nightly by `.github/workflows/backup-restore.yml`, which takes a backup, destroys the original volume, restores into a fresh one, and asserts the row count matches. Run it on demand from the Actions tab ("Backup Restore" → Run workflow).

**Backups may contain credentials** (operator hashes, WP app-passwords, Plesk/SMTP settings). Store them with restricted permissions (`chmod 0600`, which the script applies), in a location not served by the app, and rotate old copies on whatever cadence suits you. The nightly workflow uses throwaway data only — it does not back up or restore production.

## Notes

- The container runs as a non-root user (`nextjs`). The mounted `.env` is read-only.
- Secrets are **never baked into the image** — they only exist in `.env` on the host, mounted at container start.
- The container serves plain HTTP on the configured port. Put it behind a TLS-terminating reverse proxy (Caddy, nginx, Traefik) for public-facing deployments — out of scope for this issue.
