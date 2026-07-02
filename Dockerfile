# syntax=docker/dockerfile:1
# Apof.ai — production Docker image (Next.js 15 App Router, standalone output).
#
# Three stages:
#   deps    — install dependencies reproducibly (npm ci, lockfile-pinned)
#   builder — generate the Prisma (PostgreSQL) client + `next build`
#   runner  — minimal runtime image: only the standalone server + static assets
#
# What is deliberately NOT baked into the image (see .dockerignore):
#   .env / .env.local / any real secrets, node_modules, .next/cache,
#   prisma/dev.db (local SQLite), data/raw|pdf|cache (local-only artifacts),
#   graphify-out/, .git, tests.
#
# Runtime data (raw HTML/PDF snapshots, offline imports) must be a persistent
# volume mounted at /app/data in Coolify — it is NOT part of this image.

ARG NODE_VERSION=24-slim

# ---------------------------------------------------------------------------
# deps — install once, reused by the builder stage
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# openssl is required by Prisma's query engine on Debian-based images.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# builder — generate the Postgres-targeting Prisma client, then `next build`
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# A placeholder DATABASE_URL is enough for `prisma generate` (it only needs a
# syntactically valid postgres URL, not a reachable one — no DB connection
# happens at generate time). The REAL DATABASE_URL is supplied at runtime by
# Coolify and is never baked into the image.
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/apofai"
ENV NEXT_TELEMETRY_DISABLED=1

RUN node scripts/generate-postgres-schema.mjs \
    && npx prisma generate --schema=prisma/schema.production.prisma \
    && npm run build

# ---------------------------------------------------------------------------
# runner — minimal production image
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Bind to all interfaces so Coolify's reverse proxy can reach the container.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Standalone server output (only the deps actually used at runtime) + static assets.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma needs its schema + migrations at runtime for `prisma migrate deploy`
# (run as a separate one-off Coolify command, not automatically on boot).
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Local-first data directory (raw HTML/PDF snapshots, cache). Mount a Coolify
# persistent volume here — do not rely on container-local storage surviving
# a redeploy.
RUN mkdir -p /app/data/raw /app/data/pdf /app/data/cache && chown -R nextjs:nodejs /app/data

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
