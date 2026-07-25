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

The SQLite DB lives at `/app/data/app.db` inside the container (backed by the `app-data` named volume). To back it up from the host:

```bash
docker run --rm -v app-data:/data -v "$(pwd)":/backup alpine \
  sh -c "cp /data/app.db /backup/app.db.$(date +%Y%m%d)"
```

(This repo intentionally has no automated backup mechanism — issue #15's NG-2. Run the above on whatever cadence suits you.)

## Notes

- The container runs as a non-root user (`nextjs`). The mounted `.env` is read-only.
- Secrets are **never baked into the image** — they only exist in `.env` on the host, mounted at container start.
- The container serves plain HTTP on the configured port. Put it behind a TLS-terminating reverse proxy (Caddy, nginx, Traefik) for public-facing deployments — out of scope for this issue.
