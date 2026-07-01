# Apof.ai

A fast, beautiful, **local-first Indonesian legal intelligence platform** — store,
search, analyze, and **ask grounded questions** about Mahkamah Agung court
decisions, with citation-first answers. Built on the original Putusan Pro research
interface; data is sourced from the public Mahkamah Agung decision directory
([putusan3.mahkamahagung.go.id](https://putusan3.mahkamahagung.go.id/)).

> **Not an official Mahkamah Agung product.** This is a personal research tool.
> The court website is the source of truth; Apof.ai is a local index, summarizer,
> Q&A assistant, and dashboard. Original source links are preserved on every case.
>
> **Apof.ai is not a lawyer and does not provide legal advice.** It may make
> mistakes — always verify against the original documents and consult a qualified
> legal professional for legal decisions.

![status](https://img.shields.io/badge/build-passing-success) ![tests](https://img.shields.io/badge/tests-64%20passing-success) ![local--first](https://img.shields.io/badge/local--first-yes-blue)

> **Ask Apof.ai (RAG):** grounded legal Q&A over your stored decisions, runs fully
> locally in mock mode with zero setup, upgradeable to local Ollama models. See
> **[docs/RAG.md](docs/RAG.md)** and **[docs/APOF_AI_ARCHITECTURE.md](docs/APOF_AI_ARCHITECTURE.md)**.
> Quick start: `npm run rag:index` then open a case → **Ask Apof.ai** tab.

---

## ✨ Features

- **Premium UI** — Linear/Arc/Apple-inspired design system, dark/light mode,
  command palette (`⌘K`), keyboard shortcuts (`/` to search), bento dashboard,
  beautiful empty & loading states, subtle Framer Motion, fully responsive.
- **Fast search** — over nomor putusan, parties, court, classification, year,
  amar, full text, keywords, judges. Filter chips, facets, 4 sort modes. Pluggable
  backend (SQLite local **or** Meilisearch).
- **Rich case detail** — 9 tabs: Overview · Timeline · Parties · Judges & Court ·
  Amar · Full Text (serif reader) · PDF · AI Summary · Notes.
- **Safe, resumable ingestion** — polite single fetcher (concurrency 1,
  randomized 8–20s delay, exponential backoff, robots-aware), 5 ingestion modes,
  dedup, raw-HTML snapshots, resumable jobs, live logs.
- **Privacy-conscious** — no "search by person" focus, sensitive-category flags,
  hide-names and redaction modes.
- **Demo mode** — ships with 12 realistic sample cases so the UI is fully usable
  before any ingestion.

---

## 🧱 Tech stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · shadcn-style components ·
Radix UI · Framer Motion · Recharts · Prisma · SQLite (default) / PostgreSQL ·
local SQLite search **or** Meilisearch · Cheerio (parsing) · Vitest.

> The ingestion worker is pure TypeScript (run via `tsx`) — no Python or FastAPI
> needed. Playwright is intentionally **not** used (static HTML parsing only).

---

## 🚀 Quick start

```bash
# 1. Install dependencies
npm install

# 2. Create your env file (sensible defaults included)
cp .env.example .env

# 3. Create the local database and generate the client
npm run db:push

# 4. Seed demo data so the UI is impressive immediately
npm run db:seed

# 5. Run it
npm run dev
# open http://localhost:3000
```

That's it — the dashboard, search, and case pages are fully populated with demo
data. Look for the **“Demo”** chip distinguishing sample cases from real ones.

---

## 📥 Ingesting real data (politely)

> ⚠️ **Use polite ingestion. Do not overload the public court system.** Defaults:
> concurrency 1 · randomized 8–20s delay · exponential backoff · respects
> robots.txt · honest User-Agent · allow-listed to a single host. The app refuses
> any URL outside `INGESTION_ALLOWED_HOST`.

> ℹ️ **Reality check (verified 2026):** although `robots.txt` permits indexing
> (`Allow: /`, `search=yes`), the live site returns **HTTP 403** to automated
> clients — even a polite, honestly-identified one — because of a server-side
> anti-bot/WAF challenge. Getting past that would require spoofing a browser,
> driving a headless browser through the challenge, or rotating proxies — **all
> prohibited** by this project's ethics. So automated network ingestion (Seed
> Explorer / CLI / paste-URL) will hit 403 and back off. There is **no official
> public bulk API**. Use **Offline import (E)** below for real data.

### E) Offline import (no network — recommended for real data)

You open decisions in your **own browser** (where you pass the human check),
`Save Page As → Webpage, HTML Only` and/or download the **PDF**, then import them
two ways:

**In the app:** `/ingestion → Import files` — drag & drop `.html`/`.pdf` files
onto the dropzone (this is the default ingestion mode).

**Or via CLI (folder, resumable):**
```bash
npm run ingest:import -- "C:\\path\\to\\saved-folder"
# parses every .html and .pdf under the folder; re-running skips already-imported
# files (dedup). --force to re-parse.
```

This makes **zero network requests** — it parses your local files with the exact
same parser, dedup, upsert, and indexing as live ingestion:
- **HTML** → recovers the original source URL from each page's
  canonical/`og:url` for provenance.
- **PDF** → stored locally (viewable in the case **PDF** tab, served via
  `/api/cases/[id]/pdf`), text extracted with `unpdf`, nomor putusan / amar /
  year heuristically parsed. Text-extraction failure still preserves + links the
  PDF.

Nothing is bypassed.

### A) From the UI (recommended)

Open **/ingestion**. Choose a mode:

- **Seed Explorer** — paste a listing/directory/category URL and pick a run size
  (**Small ≤100** / Medium ≤1,000 / Large ≤10,000). Defaults to Small. It walks
  pagination slowly and collects decision links. Toggle **Dry run** to discover
  URLs only (no detail fetch).
- **Import CSV/TXT** — upload a file of URLs (one per line).
- **Paste URLs** — paste many at once.
- **Single URL** — add one.
- **Re-ingest failed** — requeue everything in the `failed` state.

Every discovered URL is saved **before** any detail page is fetched, so jobs are
fully resumable. Watch progress live and open **/ingestion/jobs/[id]** for the
streaming log console.

### B) Start a small initial run from the CLI

```bash
# Discover up to ~100 decision URLs from a listing page (dry run, polite)
npm run ingest:discover -- "https://putusan3.mahkamahagung.go.id/direktori.html" --size small

# Then fetch + parse + index the discovered detail pages (resumable; Ctrl+C safe)
npm run ingest:run -- --max 50
```

### C) Import a CSV/TXT list of many URLs

Put one URL per line in `urls.txt`, then either upload it in **/ingestion →
Import CSV/TXT**, or via the API:

```bash
# Save URLs to the queue and process them (the worker dedupes + throttles)
node --env-file=.env -e "console.log('paste in the UI, or POST to /api/ingestion/jobs')"
```
The CSV/TXT and Paste modes accept any text blob — non-allowed-host URLs are
ignored automatically.

### D) Inspect the parser on one page

```bash
npm run ingest:parse -- "https://putusan3.mahkamahagung.go.id/direktori/putusan/....html"
```

---

## 🔎 Using Meilisearch (optional, faster search)

SQLite search is the zero-setup default. To switch to Meilisearch:

```bash
# 1. Run Meilisearch (Docker)
docker run -p 7700:7700 getmeili/meilisearch:latest

# 2. Point the app at it
#   in .env:
#   SEARCH_PROVIDER="meili"
#   MEILISEARCH_HOST="http://127.0.0.1:7700"
#   MEILISEARCH_API_KEY=""           # set if you enabled a master key
#   MEILISEARCH_INDEX="case_decisions"

# 3. Configure attributes + push all documents
npm run search:reindex
```

The reindex script sets:
- **searchable:** `nomor_putusan, pihak, amar_putusan, full_text, klasifikasi,
  kata_kunci, pengadilan, hakim`
- **filterable:** `tahun, tingkat_proses, klasifikasi, pengadilan, has_pdf,
  extraction_status`
- **sortable:** `tanggal_putusan, tahun, created_at`

If Meilisearch is unreachable, search **fails soft** back to the local provider
so the UI never breaks. The same `SearchParams`/`SearchResponse` shape is used by
both — flipping `SEARCH_PROVIDER` is the only change needed.

---

## 🎭 Demo mode

- `NEXT_PUBLIC_DEMO_MODE="true"` (default) and `npm run db:seed` populate 12
  synthetic cases across classifications, courts, and years.
- Demo rows carry a `_demo` marker and show a **“Demo”** chip everywhere, so fake
  data is never mistaken for a real decision.
- To start clean: delete `prisma/dev.db`, run `npm run db:push`, and skip seeding.

---

## 🗄️ Data model (Prisma)

`CaseDecision` · `DiscoveredUrl` · `IngestionJob` · `CaseNote` · `SavedCase` ·
`SearchHistory` · `AppSetting`. See [`prisma/schema.prisma`](prisma/schema.prisma).

Raw HTML snapshots are stored under `./data/raw`, the fetch cache under
`./data/cache`. Parsed metadata lives in the DB, separate from raw provenance.

> SQLite note: "list" fields (parties, judges, keywords, tags) are stored as JSON
> strings and (de)serialized via `src/lib/serialize.ts`. Switching to PostgreSQL
> only requires changing `provider` + `DATABASE_URL` and re-running migrations.

---

## 🧩 Project structure

```
design-system/         MASTER.md + per-page specs (the design system)
prisma/                schema + demo seed
scripts/               discover.ts · ingest.ts · parse-case.ts · reindex.ts (tsx CLIs)
src/app/               App Router pages + /api routes
src/components/         AppShell, Sidebar, CommandPalette, SearchView, CaseDetail,
                        IngestionView, JobLogsView, ui/* primitives, …
src/lib/                fetcher (the ONE polite fetcher), normalize-url, parse,
                        discover, ingest, search, summarize, stats, env, db
tests/                  vitest specs + HTML fixtures
```

### Key functions
`normalizeUrl` · `isAllowedSource` · `discoverDecisionUrls` ·
`fetchWithPoliteDelay` (all network goes through this) · `parseDecisionPage` ·
`extractPdfUrl` · `saveRawHtml` · `upsertCaseDecision` · `indexCaseDecision` ·
`runIngestionJob`.

---

## 🧪 Scripts

```bash
npm run dev            # dev server
npm run build          # production build
npm run start          # serve production build
npm run test           # vitest (URL normalization + parser/discovery)
npm run typecheck      # tsc --noEmit
npm run lint           # next lint
npm run db:push        # create/sync SQLite schema
npm run db:seed        # seed demo data
npm run db:studio      # Prisma Studio
npm run search:reindex # (re)index into the active search backend
```

---

## 🔐 Ingestion configuration

All limits live in `.env` and are shown (read-only) in **/settings**:

| Var | Default | Meaning |
|---|---|---|
| `INGESTION_ALLOWED_HOST` | `putusan3.mahkamahagung.go.id` | the only host that can be fetched |
| `INGESTION_CONCURRENCY` | `1` | parallel requests |
| `INGESTION_DELAY_MIN_MS` / `MAX_MS` | `8000` / `20000` | randomized delay window |
| `INGESTION_MAX_RETRIES` | `3` | retry cap |
| `INGESTION_BACKOFF_BASE_MS` | `15000` | exponential backoff base |
| `INGESTION_MAX_LISTING_PAGES` | `10` | listing pages per run |
| `INGESTION_MAX_DETAIL_PAGES` | `100` | detail pages per run |
| `INGESTION_ALLOWED_HOURS` | _(empty = always)_ | e.g. `1-6,22-23` |
| `INGESTION_RESPECT_ROBOTS` | `true` | obey robots.txt (do not disable) |

---

## 🤖 AI summaries (optional)

Disabled by default — a **deterministic, extractive** Indonesian summarizer runs
with no external calls. To enable LLM summaries, set `LLM_SUMMARIZATION_ENABLED=
"true"` and `ANTHROPIC_API_KEY`. Either way, every summary carries:
**“AI summary may be inaccurate. Always verify with the official source.”**

---

## 🧭 What still needs improvement

This is a complete MVP. Honest list of next steps:

- **Selectors are best-effort.** `parseDecisionPage` targets a generic metadata
  table + heuristics. The real putusan3 markup should be sampled and the selectors
  tightened; the parser already degrades gracefully and records per-field
  confidence + `extraction_status`, and keeps raw HTML for verification.
- **Background jobs are in-process.** `runIngestionJob` runs inside Next.js
  (fine for a personal app). For long Large runs, move it to a standalone worker
  process / queue so it survives server restarts. Job state is already in the DB,
  so this is a lift-and-shift.
- **PDF caching.** `local_pdf_path` exists in the model but PDFs are currently
  linked, not downloaded. Add a polite PDF fetch step.
- **Auth / multi-user.** None — it's single-user local-first by design.
- **Search relevance.** The local provider ranks by recency; Meilisearch gives
  true typo-tolerant relevance. Wire BM25 ranking into the local provider if you
  stay on SQLite.
- **Notes editing** supports create/delete; inline edit is a small add.
- **Tests** cover URL normalization + parsing/discovery. Add API-route and
  component tests as it grows.

---

## ⚖️ Ethics & legal

This tool exists to make personal legal research faster. It is **polite by
design**: it does not bypass CAPTCHAs, anti-bot systems, robots.txt, rate limits,
or access controls; it uses no stealth or proxy rotation; it identifies itself
honestly; and it always preserves and links the original source. Court decisions
can contain sensitive personal data — handle responsibly and lawfully. Mahkamah
Agung remains the authoritative source.
