# Apof.ai — Architecture

Apof.ai is a **local-first Indonesian legal intelligence platform** built on the
existing Putusan Pro foundation (the internal codebase/package name remains
`putusan-pro`; the product is **Apof.ai**). It stores, searches, analyzes, and
explains Mahkamah Agung decisions — with grounded, citation-first Q&A.

## Stack
Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind ·
shadcn-style Radix primitives · Prisma 5 + SQLite (Postgres-ready) · local
SQLite search (+ optional Meilisearch) · Cheerio · unpdf · Zod · tsx workers ·
Vitest. Dark-first legal-reader UI (Inter / Newsreader / JetBrains Mono).

## Layers
```
Next.js single process
  ├─ React UI (case detail "Ask Apof.ai" tab, ingestion, search, dashboard)
  ├─ Server Components (DB-direct reads)
  ├─ API routes  (/api/search, /api/ingestion/*, /api/cases/*, /api/rag/*)
  ├─ src/lib domain logic
  │    ├─ fetcher.ts        ← THE single polite network choke point (unchanged)
  │    ├─ parse / ingest / import / search / summarize / case / stats
  │    ├─ legal/            ← types, section detection, normalization
  │    ├─ document-extraction/ ← page-aware: pdf-text, html-text, plain-text, ocr
  │    └─ rag/              ← chunk, embeddings, vector-store, similarity,
  │                            retrieve, rerank, prompts, llm, verify, answer, index
  ├─ Prisma SQLite database
  ├─ data/raw · data/pdf · data/cache
  └─ tsx worker scripts (ingest, import, rag:index, …)
```

## Core principles (preserved)
- **All outbound network to source sites goes through `fetchWithPoliteDelay`.**
  The RAG layer is **offline/local** and never touches it.
- No scraping bypasses, stealth, proxies, or anti-bot workarounds.
- Offline import and local-first remain first-class.
- Citation-first; abstain (“Tidak ditemukan dalam dokumen yang tersedia.”) when
  evidence is insufficient. Mock providers are clearly labeled dev-only.

## Data model (RAG additions)
`DocumentPage` (page-aware text + confidence) · `DocumentChunk` (legal-aware,
section-preserving, deterministic IDs) · `ChunkEmbedding` (vector JSON, per
provider+model) · `RagQueryLog` (audit). `CaseDecision` gains `pages` and
`chunks` relations. Existing models and data are unchanged and compatible.

## Provider abstractions (swap via `.env`, no code change)
- **Embeddings:** `mock` (default, deterministic) · `ollama` · `custom_http`.
- **Vector store:** `sqlite` (default) · `qdrant` (optional).
- **Reranker:** `none` (default) · `mock` · `custom_http`.
- **LLM:** `mock` (default, extractive) · `ollama` · `custom_http`.

See [RAG.md](./RAG.md) for setup, mock vs. local models, OCR, privacy,
hallucination/citation policy, evaluation, and licensing.
