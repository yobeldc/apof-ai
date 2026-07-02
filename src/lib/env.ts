/**
 * Centralized, typed environment access with safe defaults so the app runs
 * out of the box. Never read process.env directly elsewhere.
 */

function str(key: string, fallback: string): string {
  const v = process.env[key];
  return v === undefined || v === "" ? fallback : v;
}
function num(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function bool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  return v === "true" || v === "1";
}

export const env = {
  appName: str("NEXT_PUBLIC_APP_NAME", "Apof.ai"),
  demoMode: bool("NEXT_PUBLIC_DEMO_MODE", true),

  searchProvider: str("SEARCH_PROVIDER", "local") as "local" | "meili",
  meili: {
    host: str("MEILISEARCH_HOST", "http://127.0.0.1:7700"),
    apiKey: str("MEILISEARCH_API_KEY", ""),
    index: str("MEILISEARCH_INDEX", "case_decisions"),
  },

  ingestion: {
    allowedHost: str("INGESTION_ALLOWED_HOST", "putusan3.mahkamahagung.go.id"),
    userAgent: str(
      "INGESTION_USER_AGENT",
      "PutusanPro-PersonalResearch/0.1 (+local; contact: you@example.com)",
    ),
    concurrency: num("INGESTION_CONCURRENCY", 1),
    delayMinMs: num("INGESTION_DELAY_MIN_MS", 8000),
    delayMaxMs: num("INGESTION_DELAY_MAX_MS", 20000),
    maxRetries: num("INGESTION_MAX_RETRIES", 3),
    backoffBaseMs: num("INGESTION_BACKOFF_BASE_MS", 15000),
    maxListingPages: num("INGESTION_MAX_LISTING_PAGES", 10),
    maxDetailPages: num("INGESTION_MAX_DETAIL_PAGES", 100),
    allowedHours: str("INGESTION_ALLOWED_HOURS", ""),
    respectRobots: bool("INGESTION_RESPECT_ROBOTS", true),
  },

  storageDir: str("STORAGE_DIR", "./data"),

  llm: {
    enabled: bool("LLM_SUMMARIZATION_ENABLED", false),
    apiKey: str("ANTHROPIC_API_KEY", ""),
    model: str("LLM_MODEL", "claude-opus-4-8"),
  },

  // --- Apof.ai RAG layer (defaults to fully-local mock mode, zero services) ---
  rag: {
    enabled: bool("RAG_ENABLED", true),
    embeddingProvider: str("RAG_EMBEDDING_PROVIDER", "mock") as
      | "mock"
      | "ollama"
      | "custom_http",
    embeddingModel: str("RAG_EMBEDDING_MODEL", "mock-embedding-v1"),
    embeddingDimension: num("RAG_EMBEDDING_DIMENSION", 0), // 0 = auto-detect from the provider
    embeddingBaseUrl: str("RAG_EMBEDDING_BASE_URL", "http://localhost:11434"),
    embeddingHttpUrl: str("RAG_EMBEDDING_HTTP_URL", ""),
    vectorProvider: str("RAG_VECTOR_PROVIDER", "sqlite") as "sqlite" | "qdrant",
    rerankerProvider: str("RAG_RERANKER_PROVIDER", "none") as "none" | "mock" | "custom_http",
    rerankerHttpUrl: str("RAG_RERANKER_HTTP_URL", ""),
    llmProvider: str("RAG_LLM_PROVIDER", "mock") as "mock" | "ollama" | "custom_http",
    llmModel: str("RAG_LLM_MODEL", "mock-answer-v1"),
    llmBaseUrl: str("RAG_LLM_BASE_URL", "http://localhost:11434"),
    llmHttpUrl: str("RAG_LLM_HTTP_URL", ""),
    // Resource controls for constrained VPS/GPU deployments (Ollama options).
    // 0/unset = let Ollama use its own defaults.
    llmNumCtx: num("RAG_LLM_NUM_CTX", 0),
    llmNumPredict: num("RAG_LLM_NUM_PREDICT", 0),
    llmTemperature: num("RAG_LLM_TEMPERATURE", 0.2),
    qdrantUrl: str("QDRANT_URL", "http://localhost:6333"),
    qdrantApiKey: str("QDRANT_API_KEY", ""),
    qdrantCollection: str("QDRANT_COLLECTION", "apof_chunks"),
    // Optional self-hosted OCR endpoint (no paid API). Empty = OCR disabled.
    ocrHttpUrl: str("RAG_OCR_HTTP_URL", ""),
  },
};

export type IngestionConfig = typeof env.ingestion;
export type RagConfig = typeof env.rag;
