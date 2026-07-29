# syntax=docker/dockerfile:1
# AC-2 (issue #15): multi-stage build for Next.js standalone output.
# Targets linux/amd64 (NG-1: no multi-arch). Runs as non-root.
#
# Stage 1 (deps): install all deps + native-build toolchain so better-sqlite3
#                 can compile if no prebuilt binary matches the alpine/musl ABI.
# Stage 2 (build): compile the Next.js standalone output.
# Stage 3 (runner): minimal runtime image — standalone server + static assets
#                   + only the prod node_modules, as a non-root user.

############################
# Stage 1: deps
############################
FROM node:22-alpine AS deps

# Toolchain needed if better-sqlite3 falls back to source compile on alpine/musl.
# Kept in the deps stage only; never reaches the runner stage.
RUN apk add --no-cache python3 make g++ libc6-compat

WORKDIR /app

# Install deps using the lockfile for reproducibility.
COPY package.json package-lock.json* ./
# --ignore-scripts so we control native (re)builds in the build stage; safer
# and faster than letting every dep's install script run.
RUN npm ci --ignore-scripts

############################
# Stage 2: build
############################
FROM node:22-alpine AS build

RUN apk add --no-cache python3 make g++ libc6-compat

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the standalone output (next.config: output: "standalone").
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Ensure /app/public exists in the build stage so the runner's COPY always
# succeeds (this project currently has no /public assets; Next.js's own Docker
# example does the same mkdir -p to handle the empty-public case).
RUN mkdir -p /app/public

# better-sqlite3 ships prebuilt binaries; if the alpine/musl prebuild didn't
# match, compile the native binding now against the exact runtime ABI.
RUN npm rebuild better-sqlite3

############################
# Stage 3: runner (final image)
############################
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# AC-5: SQLite file lives inside the volume-mounted /app/data dir.
ENV DATABASE_FILE=/app/data/app.db
ENV PORT=3000
# Allow HOSTNAME binding so `next start`-equivalent listens on all interfaces.
ENV HOSTNAME=0.0.0.0
ARG COMMIT_SHA=unknown
ENV COMMIT_SHA=$COMMIT_SHA

# Run as a non-root user (AC-2).
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs

# Standalone server + the minimal node_modules it needs.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
# @next/env is NOT included in the standalone bundle but our entrypoint needs
# it to load /app/.env (Next.js's standalone production server does not load
# .env files itself the way `next dev` does).
COPY --from=build --chown=nextjs:nodejs /app/node_modules/@next/env ./node_modules/@next/env
# Entrypoint that loads .env before starting the server.
COPY --chown=nextjs:nodejs docker-entrypoint.js ./docker-entrypoint.js
# Static assets (the standalone server expects these siblings).
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
# Public dir (guaranteed to exist because the build stage creates it).
COPY --from=build --chown=nextjs:nodejs /app/public ./public

# Persistent data dir for SQLite + uploads (compose mounts a named volume here).
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000

# Run the standalone server via docker-entrypoint.js, which loads /app/.env
# (mounted read-only by compose) into process.env before starting. The Next.js
# standalone production server does not load .env itself the way `next dev` does.
CMD ["node", "docker-entrypoint.js"]
