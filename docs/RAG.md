# Apof.ai — RAG (legal Q&A) guide

Apof.ai answers questions **only from your stored Indonesian court decisions**,
citing exact evidence. It runs **fully locally** and works out of the box in a
deterministic **mock mode** — no external services, no paid APIs, no model
download required.

> **Legal disclaimer:** Apof.ai is a legal research and document-understanding
> assistant. It is not a lawyer, does not provide legal advice, and may make
> mistakes. Always verify outputs against the original legal documents and
> consult a qualified legal professional for legal decisions.

---

## Pipeline

```
Offline import (HTML/PDF, no network)
  → page-aware extraction (unpdf / Cheerio / plain text; OCR interface)
  → normalized legal document (metadata + cleaned text + detected sections)
  → legal-aware chunking (section-preserving, ~4k chars, ~600 overlap)
  → embeddings (mock | ollama | custom_http) stored in SQLite
  → hybrid retrieval (keyword + vector, RRF merge, dedup) [+ optional rerank]
  → evidence pack (quotes + source IDs + page/section metadata)
  → grounded answer (mock | ollama | custom_http)
  → verification (citations exist, quotes supported, confidence downgrade/abstain)
  → answer + simple explanation + citations + limitations
```

Code lives in `src/lib/legal/`, `src/lib/document-extraction/`, and
`src/lib/rag/`. See [APOF_AI_ARCHITECTURE.md](./APOF_AI_ARCHITECTURE.md).

---

## Quick start (mock mode — zero setup)

```bash
npm run db:push          # ensure RAG tables exist
npm run db:seed          # demo cases (optional)
npm run rag:index        # extract → chunk → embed all cases (mock embeddings)
npm run dev              # open a case → "Ask Apof.ai" tab, or the global /ask page
```

Ask globally at **`/ask`** (across all indexed cases) or per-case via the
**Ask Apof.ai** tab on a decision. Evaluate retrieval/answers with `npm run rag:eval`.

Ask: *“Apa amar putusannya?”*, *“Apa pertimbangan hukum hakim?”*, etc.

Indexing CLI:
```bash
npm run rag:index                       # all cases (idempotent — skips done work)
npm run rag:index -- --case-id CASE_ID  # one case
npm run rag:index -- --force            # re-extract + re-chunk + re-embed
```

API:
```
POST /api/rag/index   { "caseDecisionId"?: string, "force"?: boolean }
POST /api/rag/query   { "question": string, "caseDecisionId"?: string, "filters"?: {...}, "topK"?: number }
GET  /api/rag/status  → providers, models, counts, warnings, suggestions
```

---

## What works without local models

In the default config, **everything in the pipeline works**:
import → extract → normalize → chunk → embed (mock) → hybrid retrieve →
grounded answer (mock) → verify → cite. The UI clearly labels mock mode.

The **mock embedding** and **mock answer** providers are **development/testing
only**: deterministic and reproducible, but **not semantically strong**. Mock
answers are *extractive* (they stitch top evidence together) and never pretend to
be intelligent analysis. In mock mode a lexical-grounding gate makes unsupported
questions correctly return **“Tidak ditemukan dalam dokumen yang tersedia.”**

## What requires local models

For real semantic retrieval and fluent grounded explanations, run **Ollama**
(free, open-weight, local):

```bash
# 1. Install Ollama (https://ollama.com), then pull open-weight models:
ollama pull bge-m3        # multilingual embeddings (good for Indonesian)
ollama pull qwen3:8b      # local chat model for grounded answers

# 2. Point Apof.ai at it (.env):
RAG_EMBEDDING_PROVIDER=ollama
RAG_EMBEDDING_MODEL=bge-m3
RAG_LLM_PROVIDER=ollama
RAG_LLM_MODEL=qwen3:8b
RAG_EMBEDDING_BASE_URL=http://localhost:11434
RAG_LLM_BASE_URL=http://localhost:11434

# 3. Re-embed with the real model and restart:
npm run rag:index -- --force
```

If Ollama is unreachable, Apof.ai **fails gracefully** — retrieval falls back to
keyword-only and the answer surface shows the evidence with a clear limitation
note rather than crashing.

A generic **`custom_http`** provider is also supported for any self-hosted
embedding/LLM server (OpenAI-compatible chat, `{input:[...]}` embeddings) via
`RAG_EMBEDDING_HTTP_URL` / `RAG_LLM_HTTP_URL`.

## Optional Qdrant vector store

SQLite vector search (cosine similarity in TypeScript over `ChunkEmbedding.vectorJson`)
is the default and is fine for small local corpora. **Qdrant is optional** and
never required. A working Qdrant adapter is implemented (REST API): set
`RAG_VECTOR_PROVIDER=qdrant` and the `QDRANT_*` vars, then `npm run rag:index -- --force`
to push points (the collection is auto-created; embeddings also stay in SQLite as
the source of truth). If Qdrant is unreachable, retrieval falls back to keyword.

---

## OCR limitations

PDF text is extracted with `unpdf`. **Scanned PDFs** (image-only) produce little
or no text — Apof.ai marks them `pdf_ocr` / partial and returns a clear warning.
OCR is an **optional interface** (`src/lib/document-extraction/ocr.ts`); we do
**not** bundle a paid OCR API or browser automation. Set `RAG_OCR_HTTP_URL` to a
self-hosted OCR endpoint (POSTs the PDF bytes; expects `{pages:[{pageNumber,text}]}`
or `{text}`) to enable it. Unset = OCR off with a clear warning.

## Hallucination & citation policy

- **Citation-first:** every factual claim must cite an evidence `source ID`.
- **Verification** (`src/lib/rag/verify.ts`): citations referencing non-existent
  evidence are dropped; quotes that don’t approximately appear in the cited chunk
  are replaced with a real excerpt; confidence is downgraded when evidence is
  weak or unsupported; the system **abstains** when evidence is absent.
- **No invention:** the prompt forbids inventing facts, parties, articles,
  judges, dates, rulings, or procedural history.
- Answers always carry: *“AI summary may be inaccurate. Always verify with the
  official source.”*

## Privacy

Local-first: documents, pages, chunks, embeddings, and query logs stay in your
local SQLite DB and `data/` folder. Mock mode makes **no network calls** at all.
Ollama/Qdrant, when enabled, run on your machine. No data leaves your device
unless you explicitly configure a remote endpoint.

## Evaluation (how to benchmark)

A simple JSONL benchmark format (build 20–50 items across your real cases):
```json
{"id":"q001","caseDecisionId":"<id>","question":"Apa amar putusan perkara ini?",
 "expectedEvidenceContains":["MENGADILI","Menolak permohonan kasasi"],
 "expectedAnswerContains":["menolak","kasasi"],"category":"final_ruling"}
```
Recommended metrics: Recall@k and MRR (does retrieval surface the expected
evidence?), citation-support rate and quote-support rate (verification), and
not-found correctness (does it abstain on out-of-scope questions?). Fluency and
beginner-friendliness are manual review placeholders. (A scorer script can be
added at `scripts/eval-rag.ts` reusing `retrieveEvidence` + `answerQuestion`.)

## Licensing distinctions

- **App code:** open-source (this repository).
- **Models:** open-weight (e.g. `bge-m3`, `qwen3` via Ollama) — run locally.
- **Tools:** free / self-hostable (Ollama, Qdrant, SQLite).
- **Proprietary cloud APIs:** **not used by default** anywhere in the RAG path.
