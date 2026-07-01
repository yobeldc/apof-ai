import { describe, it, expect } from "vitest";
import { getEmbeddingProvider, isMockEmbeddings } from "@/lib/rag/embeddings";
import { cosineSimilarity, dot, reciprocalRankFusion } from "@/lib/rag/similarity";

describe("mock embeddings", () => {
  it("is the active provider in mock mode", () => {
    expect(isMockEmbeddings()).toBe(true);
  });

  it("is deterministic for the same text", async () => {
    const p = getEmbeddingProvider();
    const [a] = await p.embedDocuments([{ id: "1", text: "Menolak permohonan kasasi" }]);
    const [b] = await p.embedDocuments([{ id: "2", text: "Menolak permohonan kasasi" }]);
    expect(a.vector).toEqual(b.vector);
    expect(a.dimensions).toBe(a.vector.length);
  });

  it("produces L2-normalized vectors (self cosine ≈ 1)", async () => {
    const p = getEmbeddingProvider();
    const r = await p.embedQuery("pertimbangan hukum hakim");
    expect(cosineSimilarity(r.vector, r.vector)).toBeCloseTo(1, 5);
  });

  it("ranks similar text higher than unrelated text", async () => {
    const p = getEmbeddingProvider();
    const q = await p.embedQuery("amar putusan menolak kasasi");
    const docs = await p.embedDocuments([
      { id: "rel", text: "Mengadili menolak permohonan kasasi terdakwa" },
      { id: "unrel", text: "resep memasak nasi goreng spesial" },
    ]);
    const relScore = cosineSimilarity(q.vector, docs[0].vector);
    const unrelScore = cosineSimilarity(q.vector, docs[1].vector);
    expect(relScore).toBeGreaterThan(unrelScore);
  });
});

describe("similarity math", () => {
  it("cosine of identical unit vectors is 1", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
  });
  it("cosine of orthogonal vectors is 0", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });
  it("returns 0 for empty/zero vectors (no crash)", () => {
    expect(cosineSimilarity([], [1, 2])).toBe(0);
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
  });
  it("dot product is correct", () => {
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32);
  });
});

describe("reciprocal rank fusion", () => {
  it("merges and ranks by fused score, deduping ids", () => {
    const fused = reciprocalRankFusion([
      [{ id: "a", rank: 1 }, { id: "b", rank: 2 }],
      [{ id: "b", rank: 1 }, { id: "c", rank: 2 }],
    ]);
    expect(fused[0].id).toBe("b"); // appears high in both lists
    expect(new Set(fused.map((f) => f.id)).size).toBe(fused.length);
  });
});
