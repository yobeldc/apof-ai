import crypto from "node:crypto";
import { env } from "../env";

/**
 * Embedding provider abstraction. Default is the deterministic MOCK provider —
 * DEVELOPMENT/TESTING ONLY, not semantically strong — so the whole RAG slice
 * runs with zero external services. Ollama + custom_http are real local options
 * that fail gracefully if unavailable.
 */

export type EmbeddingInput = { id: string; text: string };
export type EmbeddingResult = {
  id: string;
  vector: number[];
  dimensions: number;
  model: string;
  provider: string;
};

export interface EmbeddingProvider {
  readonly provider: string;
  readonly model: string;
  readonly dimensions: number;
  embedDocuments(inputs: EmbeddingInput[]): Promise<EmbeddingResult[]>;
  embedQuery(query: string): Promise<EmbeddingResult>;
}

// ---------------------------------------------------------------------------
// MOCK provider — deterministic hashed bag-of-tokens vector. Dev-only.
// ---------------------------------------------------------------------------
const MOCK_DIM = 256;

function mockVector(text: string): number[] {
  const vec = new Array(MOCK_DIM).fill(0);
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  for (const tok of tokens) {
    const h = crypto.createHash("md5").update(tok).digest();
    const idx = h.readUInt16BE(0) % MOCK_DIM;
    const sign = h[2] % 2 === 0 ? 1 : -1;
    vec[idx] += sign;
  }
  // L2 normalize so cosine similarity is meaningful.
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

class MockEmbeddingProvider implements EmbeddingProvider {
  provider = "mock";
  model = env.rag.embeddingModel || "mock-embedding-v1";
  dimensions = MOCK_DIM;
  async embedDocuments(inputs: EmbeddingInput[]): Promise<EmbeddingResult[]> {
    return inputs.map((i) => ({ id: i.id, vector: mockVector(i.text), dimensions: MOCK_DIM, model: this.model, provider: this.provider }));
  }
  async embedQuery(query: string): Promise<EmbeddingResult> {
    return { id: "query", vector: mockVector(query), dimensions: MOCK_DIM, model: this.model, provider: this.provider };
  }
}

// ---------------------------------------------------------------------------
// OLLAMA provider — POST /api/embeddings. Fails gracefully if not running.
// ---------------------------------------------------------------------------
class OllamaEmbeddingProvider implements EmbeddingProvider {
  provider = "ollama";
  model = env.rag.embeddingModel;
  dimensions = env.rag.embeddingDimension; // declared via env; refined on first call
  private baseUrl = env.rag.embeddingBaseUrl.replace(/\/$/, "");

  private async embedOne(text: string): Promise<number[]> {
    const res = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: this.model, prompt: text }),
    });
    if (!res.ok) throw new Error(`Ollama embeddings HTTP ${res.status}`);
    const data = await res.json();
    const vec: number[] = data.embedding ?? data.embeddings?.[0];
    if (!Array.isArray(vec)) throw new Error("Ollama returned no embedding");
    this.dimensions = vec.length;
    return vec;
  }
  async embedDocuments(inputs: EmbeddingInput[]): Promise<EmbeddingResult[]> {
    const out: EmbeddingResult[] = [];
    for (const i of inputs) {
      const vector = await this.embedOne(i.text);
      out.push({ id: i.id, vector, dimensions: vector.length, model: this.model, provider: this.provider });
    }
    return out;
  }
  async embedQuery(query: string): Promise<EmbeddingResult> {
    const vector = await this.embedOne(query);
    return { id: "query", vector, dimensions: vector.length, model: this.model, provider: this.provider };
  }
}

// ---------------------------------------------------------------------------
// CUSTOM_HTTP provider — generic local server: POST {model, input:[...]} → {data:[{embedding}]}
// ---------------------------------------------------------------------------
class CustomHttpEmbeddingProvider implements EmbeddingProvider {
  provider = "custom_http";
  model = env.rag.embeddingModel;
  dimensions = 0;
  private url = env.rag.embeddingHttpUrl;

  private async call(texts: string[]): Promise<number[][]> {
    if (!this.url) throw new Error("RAG_EMBEDDING_HTTP_URL is not configured");
    const res = await fetch(this.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!res.ok) throw new Error(`Custom embeddings HTTP ${res.status}`);
    const data = await res.json();
    const vectors: number[][] = (data.data ?? []).map((d: { embedding: number[] }) => d.embedding);
    if (!vectors.length) throw new Error("Custom embeddings returned no data");
    this.dimensions = vectors[0].length;
    return vectors;
  }
  async embedDocuments(inputs: EmbeddingInput[]): Promise<EmbeddingResult[]> {
    const vecs = await this.call(inputs.map((i) => i.text));
    return inputs.map((i, idx) => ({ id: i.id, vector: vecs[idx], dimensions: vecs[idx].length, model: this.model, provider: this.provider }));
  }
  async embedQuery(query: string): Promise<EmbeddingResult> {
    const [vec] = await this.call([query]);
    return { id: "query", vector: vec, dimensions: vec.length, model: this.model, provider: this.provider };
  }
}

let cached: EmbeddingProvider | null = null;
export function getEmbeddingProvider(): EmbeddingProvider {
  if (cached) return cached;
  switch (env.rag.embeddingProvider) {
    case "ollama":
      cached = new OllamaEmbeddingProvider();
      break;
    case "custom_http":
      cached = new CustomHttpEmbeddingProvider();
      break;
    default:
      cached = new MockEmbeddingProvider();
  }
  return cached;
}

/** True when the active embedding provider is the dev-only mock. */
export function isMockEmbeddings(): boolean {
  return env.rag.embeddingProvider === "mock";
}
