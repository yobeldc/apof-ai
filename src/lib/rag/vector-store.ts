import crypto from "node:crypto";
import { prisma } from "../db";
import { env } from "../env";
import { cosineSimilarity } from "./similarity";

/**
 * Vector store abstraction. The SQLite fallback stores vectors as JSON and ranks
 * in TypeScript with cosine similarity — fine for small local prototypes only.
 * The VectorStore interface lets a Qdrant backend slot in later without touching
 * callers.
 */

export type VectorSearchInput = {
  queryVector: number[];
  topK: number;
  filters?: {
    caseDecisionId?: string;
    sectionKind?: string;
    year?: number;
    court?: string;
  };
};

export type VectorSearchResult = {
  chunkId: string;
  score: number;
  provider: string;
};

export type VectorPoint = {
  chunkId: string;
  vector: number[];
  payload: {
    caseDecisionId: string;
    caseNumber?: string | null;
    sectionKind?: string | null;
    sectionTitle?: string | null;
    pageStart?: number | null;
    pageEnd?: number | null;
  };
};

export interface VectorStore {
  readonly provider: string;
  search(input: VectorSearchInput): Promise<VectorSearchResult[]>;
  /** Upsert points into the store. No-op for SQLite (vectors live in the DB). */
  upsert?(points: VectorPoint[]): Promise<void>;
}

class SqliteVectorStore implements VectorStore {
  provider = "sqlite";

  async search(input: VectorSearchInput): Promise<VectorSearchResult[]> {
    const { queryVector, topK, filters } = input;

    // Load candidate embeddings, optionally constrained by chunk metadata.
    const chunkWhere: Record<string, unknown> = {};
    if (filters?.caseDecisionId) chunkWhere.caseDecisionId = filters.caseDecisionId;
    if (filters?.sectionKind) chunkWhere.sectionKind = filters.sectionKind;

    const embeddings = await prisma.chunkEmbedding.findMany({
      where: {
        model: env.rag.embeddingModel,
        ...(Object.keys(chunkWhere).length ? { chunk: chunkWhere } : {}),
      },
      select: { chunkId: true, vectorJson: true },
      take: 5000, // local prototype guard
    });

    if (embeddings.length === 0) return [];

    const scored: VectorSearchResult[] = [];
    for (const e of embeddings) {
      let vec: number[];
      try {
        vec = JSON.parse(e.vectorJson);
      } catch {
        continue;
      }
      scored.push({ chunkId: e.chunkId, score: cosineSimilarity(queryVector, vec), provider: this.provider });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }
}

/**
 * Qdrant vector store (optional, not required). Uses the REST API; fails
 * gracefully (search returns [] and logs) if Qdrant is unreachable so retrieval
 * falls back to keyword. Embeddings also remain in SQLite as the source of truth.
 */
class QdrantVectorStore implements VectorStore {
  provider = "qdrant";
  private base = env.rag.qdrantUrl.replace(/\/$/, "");
  private collection = env.rag.qdrantCollection;
  private headers = {
    "content-type": "application/json",
    ...(env.rag.qdrantApiKey ? { "api-key": env.rag.qdrantApiKey } : {}),
  };
  private ensured = false;

  /** Deterministic UUID point id from a chunk id (Qdrant needs uint64 or UUID). */
  private pointId(chunkId: string): string {
    const h = crypto.createHash("sha256").update(chunkId).digest("hex").slice(0, 32);
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
  }

  private async ensureCollection(dim: number) {
    if (this.ensured) return;
    // Create the collection if it doesn't exist (cosine distance).
    const exists = await fetch(`${this.base}/collections/${this.collection}`, { headers: this.headers })
      .then((r) => r.ok)
      .catch(() => false);
    if (!exists) {
      await fetch(`${this.base}/collections/${this.collection}`, {
        method: "PUT",
        headers: this.headers,
        body: JSON.stringify({ vectors: { size: dim, distance: "Cosine" } }),
      });
    }
    this.ensured = true;
  }

  async upsert(points: VectorPoint[]): Promise<void> {
    if (points.length === 0) return;
    await this.ensureCollection(points[0].vector.length);
    await fetch(`${this.base}/collections/${this.collection}/points`, {
      method: "PUT",
      headers: this.headers,
      body: JSON.stringify({
        points: points.map((p) => ({ id: this.pointId(p.chunkId), vector: p.vector, payload: { chunkId: p.chunkId, ...p.payload } })),
      }),
    });
  }

  async search(input: VectorSearchInput): Promise<VectorSearchResult[]> {
    const must: Record<string, unknown>[] = [];
    if (input.filters?.caseDecisionId) must.push({ key: "caseDecisionId", match: { value: input.filters.caseDecisionId } });
    if (input.filters?.sectionKind) must.push({ key: "sectionKind", match: { value: input.filters.sectionKind } });
    try {
      const res = await fetch(`${this.base}/collections/${this.collection}/points/search`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          vector: input.queryVector,
          limit: input.topK,
          with_payload: true,
          ...(must.length ? { filter: { must } } : {}),
        }),
      });
      if (!res.ok) throw new Error(`Qdrant search HTTP ${res.status}`);
      const data = await res.json();
      return (data.result ?? []).map((p: { payload?: { chunkId?: string }; score: number }) => ({
        chunkId: p.payload?.chunkId ?? "",
        score: p.score,
        provider: this.provider,
      })).filter((r: VectorSearchResult) => r.chunkId);
    } catch (err) {
      console.warn("[rag] Qdrant unavailable, keyword-only:", err instanceof Error ? err.message : err);
      return [];
    }
  }
}

/** Count embedded chunks for the active model (status reporting). */
export async function countEmbeddedChunks(): Promise<number> {
  return prisma.chunkEmbedding.count({ where: { model: env.rag.embeddingModel } });
}

let cached: VectorStore | null = null;
export function getVectorStore(): VectorStore {
  if (cached) return cached;
  cached = env.rag.vectorProvider === "qdrant" ? new QdrantVectorStore() : new SqliteVectorStore();
  return cached;
}
