import { env } from "../env";
import type { RetrievedEvidence } from "./retrieve";

/**
 * Reranker abstraction: none | mock | custom_http. A reranker is never required.
 * If none/unavailable, the hybrid order is preserved.
 */

export type RerankInput = {
  query: string;
  documents: Array<{ id: string; text: string; metadata?: Record<string, unknown> }>;
};
export type RerankResult = { id: string; score: number };

/** Mock reranker: deterministic lexical overlap score. Dev-only. */
function mockRerank(query: string, docs: RerankInput["documents"]): RerankResult[] {
  const qTerms = new Set(query.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
  return docs.map((d) => {
    const dTerms = d.text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
    let overlap = 0;
    for (const t of dTerms) if (qTerms.has(t)) overlap++;
    return { id: d.id, score: overlap / (dTerms.length || 1) };
  });
}

async function customHttpRerank(query: string, docs: RerankInput["documents"]): Promise<RerankResult[]> {
  if (!env.rag.rerankerHttpUrl) throw new Error("RAG_RERANKER_HTTP_URL not configured");
  const res = await fetch(env.rag.rerankerHttpUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, documents: docs.map((d) => ({ id: d.id, text: d.text })) }),
  });
  if (!res.ok) throw new Error(`Reranker HTTP ${res.status}`);
  const data = await res.json();
  return (data.results ?? data) as RerankResult[];
}

export async function rerank(query: string, evidence: RetrievedEvidence[]): Promise<RetrievedEvidence[]> {
  if (env.rag.rerankerProvider === "none" || evidence.length === 0) return evidence;
  try {
    const docs = evidence.map((e) => ({ id: e.chunkId, text: e.text }));
    const scores =
      env.rag.rerankerProvider === "mock"
        ? mockRerank(query, docs)
        : await customHttpRerank(query, docs);
    const scoreById = new Map(scores.map((s) => [s.id, s.score]));
    return [...evidence]
      .map((e) => ({ ...e, score: scoreById.get(e.chunkId) ?? e.score, source: "rerank" as const }))
      .sort((a, b) => b.score - a.score);
  } catch (err) {
    console.warn("[rag] rerank failed, keeping hybrid order:", err instanceof Error ? err.message : err);
    return evidence;
  }
}
