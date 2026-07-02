# Deploying Apof.ai on Coolify

This guide walks through deploying Apof.ai — Next.js app + PostgreSQL + optional
Qdrant — on [Coolify](https://coolify.io), a self-hosted PaaS. It assumes no
prior Coolify experience.

**Scope of this guide:** get the app, database, and (optional) vector store
running behind Coolify with HTTPS. **Ollama is deliberately not automated
here** — see the "Ollama deployment strategy" section below for why, and the three supported ways to connect one.

---

## Architecture at a glance

```
                         ┌─────────────────────────┐
  Internet ── HTTPS ──▶  │  Coolify reverse proxy  │
                         │  (Traefik, auto-SSL)    │
                         └───────────┬─────────────┘
                                     │ private network
                         ┌───────────▼─────────────┐
                         │   Apof.ai (Next.js)     │  ← this repo, Dockerfile
                         │   :3000                 │
                         └───┬─────────┬───────┬───┘
                             │         │       │
                    ┌────────▼──┐ ┌────▼───┐ ┌─▼──────────────────┐
                    │ PostgreSQL│ │ Qdrant │ │ Ollama (optional,  │
                    │ (Coolify  │ │ :6333  │ │ NEVER public —     │
                    │ managed)  │ │        │ │ see below)         │
                    └───────────┘ └────────┘ └────────────────────┘
```

Only the app is exposed to the internet. Postgres, Qdrant, and Ollama talk to
it over Coolify's private Docker network only.

---

## Ollama deployment strategy (read before provisioning)

**Never expose Ollama's port (11434) to the public internet.** It has no
built-in authentication — anyone who can reach it can run arbitrary prompts on
your GPU/CPU and read your model list. Apof.ai talks to Ollama over
`RAG_EMBEDDING_BASE_URL`/`RAG_LLM_BASE_URL`, and there are three supported ways
to point those at a real Ollama instance:

**Option 1 — Local development** (your own machine, not Coolify):
```env
RAG_LLM_BASE_URL="http://localhost:11434"
```
This is what you already use locally. Not applicable once deployed.

**Option 2 — Same private Docker network as the app** (self-hosted on the
same Coolify server/project):
```env
RAG_LLM_BASE_URL="http://ollama:11434"
```
Run Ollama as its own Coolify service (or the commented-out block in
`docker-compose.coolify.yml`) with **no published port** — only containers on
the same private network (i.e. the Apof.ai app) can reach it by service name.
This is the simplest self-hosted option and what `.env.coolify.example`
assumes by default.

**Option 3 — External private model server** (a separate GPU box, e.g. one
you already run for other projects):
```env
RAG_LLM_BASE_URL="https://private-ollama-endpoint.internal"
```
Put it behind a VPN, an IP allowlist, or a reverse proxy with auth (Coolify,
Tailscale, or a simple nginx basic-auth layer all work) — the key requirement
is that it is **not** reachable from the open internet without credentials.

### Sizing warnings

- **`qwen3:8b` may be too heavy for a small VPS.** It needs roughly 5–6GB just
  for weights at typical quantization, plus KV cache — comfortable on a
  12GB+ GPU, tight on an 8GB GPU (works, but leave headroom for other GPU
  consumers), and slow-but-workable on CPU-only with 16GB+ system RAM.
- **For 8GB GPUs or CPU-only servers**, reduce load with:
  ```env
  RAG_LLM_NUM_CTX="2048"       # smaller context window
  RAG_LLM_NUM_PREDICT="400"    # cap output length
  ```
  or switch to a smaller model (e.g. a 3–4B class model) via `RAG_LLM_MODEL`.
- **Graceful fallback is already built in** — if Ollama is unreachable or
  out-of-memory, `/ask` and the case-detail panel show a clear
  *"Model jawaban tidak tersedia saat ini."* message with the retrieved
  evidence still visible, rather than crashing (see `src/lib/rag/answer.ts`).
  This was verified end-to-end during local Ollama setup, including a real
  GPU OOM followed by a clean recovery on retry.
- Mock mode (`RAG_EMBEDDING_PROVIDER=mock`, `RAG_LLM_PROVIDER=mock`) has zero
  resource requirements and is a legitimate production fallback if you don't
  want to run any LLM at all yet — it still answers from the document text,
  extractively, with a clear "development mode" label.

---

## 1. Create a VPS

Any VPS with a public IP works. Minimums:
- **App + Postgres + Qdrant only** (mock or remote LLM): 2 vCPU / 4GB RAM / 40GB disk.
- **+ self-hosted Ollama with `qwen3:8b`**: 8+ vCPU / 16GB+ RAM (CPU-only is slow
  but works), or a GPU instance with **≥12GB VRAM** for comfortable headroom
  (an 8GB card works but is tight — see the "Ollama deployment strategy" sizing warnings above).

Ubuntu 22.04/24.04 LTS is Coolify's best-tested target.

## 2. Install Coolify

SSH into the VPS and run Coolify's official installer script (see
https://coolify.io/docs/installation for the current one-liner — the project
updates it occasionally, so use their docs rather than a pinned copy here).
After it finishes, open `http://<server-ip>:8000` and complete the setup
wizard (create your admin account).

## 3. Connect the GitHub repository

In Coolify: **Sources → Add → GitHub App** (or a plain deploy key if you
prefer not to install the GitHub App). Authorize access to the `apof-ai`
repository (or your fork). This lets Coolify auto-deploy on push.

## 4. Create the PostgreSQL service

**Project → + New Resource → Database → PostgreSQL.**
- Coolify provisions it and generates credentials automatically.
- Copy the internal connection string it shows you (something like
  `postgresql://postgres:<generated>@<service-name>:5432/postgres`) — you'll
  paste this into `DATABASE_URL` in step 7. Rename the database to `apofai`
  if you'd like a cleaner name (optional).
- Do **not** enable a public port for Postgres unless you have a specific
  external-access need; the app reaches it over the private network by
  service name.

## 5. Optional: create the Qdrant service

**Project → + New Resource → Service → search "Qdrant"** (or deploy it as a
plain Docker image `qdrant/qdrant:latest` with a persistent volume at
`/qdrant/storage` if no one-click template exists in your Coolify version).
- Note its internal service name (used as the host in `QDRANT_URL`, e.g.
  `http://qdrant:6333`).
- Leave `QDRANT_API_KEY` empty for internal-only access, or set one and put
  the same value in the app's env if you need it reachable from elsewhere.
- **Skip this step entirely if you want to start simple** — Apof.ai runs
  fine on the SQLite vector fallback + keyword search with
  `RAG_VECTOR_PROVIDER=sqlite` (the default). Add Qdrant later without any
  code changes once you outgrow it.

## 6. Add the Apof.ai application

**Project → + New Resource → Application → "Public Repository" or your
connected GitHub source.**
- Build pack: **Dockerfile** (Coolify should auto-detect the `Dockerfile` at
  the repo root).
- Port: **3000** (matches `EXPOSE 3000` / `PORT=3000` in the Dockerfile).
- Health check path: `/api/rag/status` (fast, always 200 once the app boots)
  or `/` if you prefer checking the full page render.

## 7. Set environment variables

Open the Application's **Environment Variables** tab and paste the values
from **`.env.coolify.example`** in this repo, filling in the real values:

```env
NODE_ENV="production"
NEXT_PUBLIC_APP_NAME="Apof.ai"
NEXT_PUBLIC_DEMO_MODE="false"

DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/apofai"

STORAGE_DIR="/app/data"

RAG_ENABLED="true"

RAG_EMBEDDING_PROVIDER="ollama"
RAG_EMBEDDING_MODEL="bge-m3"
RAG_EMBEDDING_DIMENSION="1024"
RAG_EMBEDDING_BASE_URL="http://ollama:11434"

RAG_VECTOR_PROVIDER="qdrant"
QDRANT_URL="http://qdrant:6333"
QDRANT_COLLECTION="apofai_chunks"

RAG_LLM_PROVIDER="ollama"
RAG_LLM_MODEL="qwen3:8b"
RAG_LLM_BASE_URL="http://ollama:11434"
RAG_LLM_NUM_CTX="4096"
RAG_LLM_NUM_PREDICT="700"
RAG_LLM_TEMPERATURE="0.2"
```

If you don't have Ollama running yet, set `RAG_EMBEDDING_PROVIDER=mock` and
`RAG_LLM_PROVIDER=mock` for now — the app is fully functional in mock mode
(deterministic, dev-labeled answers) and you can flip these later with zero
code changes. **Never commit a filled-in copy of this file** — only the
`.example` templates belong in git.

Also add a persistent **Storage** volume mounted at `/app/data` (Application
→ Storages → Add) — this is where offline-imported HTML/PDF snapshots and the
fetch cache live. Without it, that data is wiped on every redeploy.

## 8. Run the build

Click **Deploy**. Coolify builds the `Dockerfile` (three stages: deps →
builder → runner) and starts the container. Watch the build log for:
- `npm ci` completing (dependency install),
- `node scripts/generate-postgres-schema.mjs` + `prisma generate` (Postgres
  client generation — this does **not** need a reachable database, it only
  needs a syntactically valid `DATABASE_URL`, which the Dockerfile provides
  internally at build time),
- `next build` completing with the standalone output.

## 9. Run the Prisma migration

The Docker image does **not** run migrations automatically on boot (a boot-time
migration race is a common source of production incidents when you scale to
more than one instance). Instead, run it once as a **Coolify one-off command**
after the first successful deploy:

**Application → Commands / Execute Command**, run:
```bash
npm run db:migrate:deploy
```
This regenerates `prisma/schema.production.prisma` from the checked-in source
schema and applies `prisma/migrations/` against the real `DATABASE_URL` via
`prisma migrate deploy` (safe to re-run — already-applied migrations are
skipped). Re-run this command after every deploy that changes
`prisma/schema.prisma`.

## 10. Index RAG data

Once the app is up and you've imported/ingested some decisions (see the main
README for ingestion — remember the live source site blocks automated
fetching, so **offline import** via `/ingestion` is the practical path),
index them for RAG either:
- from the UI: open a case → **Ask Apof.ai** tab → "Index this case", or the
  `/ask` page → "Index all cases", or
- as a one-off command in Coolify:
  ```bash
  npm run rag:index
  ```

Check indexing status any time at **`GET /api/rag/status`**.

## 11. Configure a custom domain

**Application → Domains** → add your domain (e.g. `apof.yourdomain.com`) and
point its DNS `A`/`AAAA` record at the VPS IP.

## 12. Enable HTTPS

Coolify automatically provisions and renews a Let's Encrypt certificate once
the domain resolves correctly — no extra configuration needed. Force HTTPS
redirect in the Domains tab if it isn't already on by default in your Coolify
version.

## 13. Verify

After DNS propagates and the cert issues, check:
- **`GET /`** — dashboard loads, shows "Apof.ai" branding.
- **`GET /ask`** — the global Ask Apof.ai page renders (mock or real answers
  depending on your RAG provider config).
- **`GET /api/rag/status`** — returns JSON with `enabled`, provider/model
  names, `counts`, and any `warnings`/`suggestions`. This is the fastest way
  to confirm the whole RAG stack (DB + embeddings + LLM + vector store) is
  wired correctly without touching the UI.

## 14. Troubleshooting

**Ollama unreachable** (`/api/rag/status` shows an LLM warning, or `/ask`
answers with *"Model jawaban tidak tersedia saat ini."*): this is the
designed graceful-fallback path, not a crash — evidence still displays. Check
that `RAG_LLM_BASE_URL`/`RAG_EMBEDDING_BASE_URL` match your actual Ollama
service name/URL, that Ollama is running (`docker ps` on the Ollama host), and
that it's reachable from the app container (`docker exec <app> curl
$RAG_LLM_BASE_URL/api/tags`).

**Qdrant unreachable**: retrieval silently falls back to keyword search (by
design — see `src/lib/rag/vector-store.ts`). Check `QDRANT_URL` and that the
Qdrant service is running; there's no user-facing crash either way.

**Database connection errors**: confirm `DATABASE_URL` exactly matches
Coolify's Postgres connection string (service name resolution only works
within the same Coolify network — a copy-pasted `localhost` URL from your
laptop will not work). Run `npm run db:migrate:deploy` again after fixing it.

**Build errors**:
- `prisma generate` failing during build usually means
  `prisma/schema.production.prisma` wasn't regenerated — the Dockerfile runs
  `node scripts/generate-postgres-schema.mjs` before `prisma generate`
  automatically, so this should self-heal; check the build log ordering if
  you've modified the Dockerfile.
- Out-of-memory during `next build` on a very small VPS: increase the
  build-time memory limit in Coolify, or build on a larger machine and let
  Coolify pull the pre-built image (advanced; not covered here).
- If you changed models under `prisma/schema.prisma`, make sure you re-ran
  `node scripts/generate-postgres-schema.mjs` (or just redeploy — the
  Dockerfile does this for you) so `schema.production.prisma` isn't stale
  relative to your migrations.
