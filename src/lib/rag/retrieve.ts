import { prisma } from "../db";
import { getEmbeddingProvider } from "./embeddings";
import { getVectorStore } from "./vector-store";
import { reciprocalRankFusion } from "./similarity";
import { rerank } from "./rerank";
import { fromJsonList } from "../serialize";

export type RagSearchInput = {
  question: string;
  caseDecisionId?: string;
  filters?: {
    court?: string;
    year?: number;
    section?: string;
    sectionKind?: string;
    caseNumber?: string;
    parties?: string[];
    legalArticles?: string[];
  };
  topK?: number;
};

export type RetrievedEvidence = {
  sourceId: string;
  chunkId: string;
  caseDecisionId: string;
  score: number;
  source: "keyword" | "vector" | "hybrid" | "rerank";
  text: string;
  caseNumber?: string | null;
  title?: string | null;
  sectionTitle?: string | null;
  sectionKind?: string | null;
  pageStart?: number | null;
  pageEnd?: number | null;
  paragraphStart?: number | null;
  paragraphEnd?: number | null;
  metadata: Record<string, unknown>;
};

const KEYWORD_TOPK = 30;
const VECTOR_TOPK = 30;
const POOL = 40;

/** Generic/stopword tokens that must not create false keyword matches. */
const STOPWORDS = new Set([
  "apa", "apakah", "yang", "ini", "itu", "dan", "atau", "dengan", "untuk", "dari", "pada",
  "dalam", "tahun", "dokumen", "menurut", "perkara", "putusan", "tersebut", "adalah", "saja",
  "bagaimana", "mengapa", "kenapa", "siapa", "kapan", "dimana", "berapa", "the", "of", "in",
]);

export function meaningfulTerms(text: string): string[] {
  const terms = text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  return Array.from(new Set(terms.filter((t) => !STOPWORDS.has(t))));
}

/**
 * Deterministic query understanding: map a question's intent to a target legal
 * section. This is what lets mock mode reliably answer "Apa amar putusannya?"
 * (→ final_ruling) even though bag-of-token embeddings can't link amar≈mengadili.
 */
const SECTION_INTENT: { re: RegExp; kind: string }[] = [
  { re: /\bamar\b|\bvonis\b|\bhukuman\b|\bmenghukum\b|\bputusannya\b|\bmengadili\b|\bdijatuhi\b|\bdiktum\b/i, kind: "final_ruling" },
  { re: /\bpertimbangan\b|\bratio\b|\bmenimbang\b|\balasan\b/i, kind: "court_reasoning" },
  { re: /\bdasar hukum\b|\bpasal\b|\bundang-undang\b|\bmengingat\b/i, kind: "legal_basis" },
  { re: /\bpihak\b|\bpemohon\b|\btermohon\b|\bpenggugat\b|\btergugat\b|\bterdakwa\b/i, kind: "parties" },
  { re: /\bisu hukum\b|\beksepsi\b/i, kind: "legal_issues" },
  { re: /\bfakta\b|\bduduk perkara\b|\bkronologi\b/i, kind: "facts" },
];

export function inferSectionKind(question: string): string | undefined {
  for (const s of SECTION_INTENT) if (s.re.test(question)) return s.kind;
  return undefined;
}

/** Section-targeted candidates (deterministic): chunks of the inferred kind. */
async function sectionSearch(input: RagSearchInput, kind: string): Promise<{ id: string; rank: number }[]> {
  const rows = await prisma.documentChunk.findMany({
    where: { sectionKind: kind, ...(input.caseDecisionId ? { caseDecisionId: input.caseDecisionId } : {}) },
    select: { id: true },
    orderBy: { chunkIndex: "asc" },
    take: 10,
  });
  return rows.map((r, i) => ({ id: r.id, rank: i + 1 }));
}

/** Keyword candidates via SQLite LIKE over normalized chunk text. */
async function keywordSearch(input: RagSearchInput): Promise<{ id: string; rank: number }[]> {
  const top = meaningfulTerms(input.question).slice(0, 8);
  if (top.length === 0) return [];
  const rows = await prisma.documentChunk.findMany({
    where: {
      ...(input.caseDecisionId ? { caseDecisionId: input.caseDecisionId } : {}),
      ...(input.filters?.sectionKind ? { sectionKind: input.filters.sectionKind } : {}),
      AND: top.map((t) => ({ normalizedText: { contains: t } })),
    },
    select: { id: true },
    take: KEYWORD_TOPK,
  });
  // Fallback: OR match if AND is too strict.
  let result = rows;
  if (result.length === 0) {
    result = await prisma.documentChunk.findMany({
      where: {
        ...(input.caseDecisionId ? { caseDecisionId: input.caseDecisionId } : {}),
        OR: top.map((t) => ({ normalizedText: { contains: t } })),
      },
      select: { id: true },
      take: KEYWORD_TOPK,
    });
  }
  return result.map((r, i) => ({ id: r.id, rank: i + 1 }));
}

/** Vector candidates via the active embedding provider + vector store. */
async function vectorSearch(input: RagSearchInput): Promise<{ id: string; rank: number }[]> {
  try {
    const provider = getEmbeddingProvider();
    const q = await provider.embedQuery(input.question);
    const store = getVectorStore();
    const results = await store.search({
      queryVector: q.vector,
      topK: VECTOR_TOPK,
      filters: {
        caseDecisionId: input.caseDecisionId,
        sectionKind: input.filters?.sectionKind,
      },
    });
    return results.map((r, i) => ({ id: r.chunkId, rank: i + 1 }));
  } catch (err) {
    console.warn("[rag] vector search unavailable, keyword-only:", err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Hybrid retrieval: keyword + vector → RRF merge → dedup → optional rerank →
 * evidence pack. Recall-favoring (legal Q&A: missing evidence is worse than a
 * little extra).
 */
export async function retrieveEvidence(input: RagSearchInput): Promise<RetrievedEvidence[]> {
  const finalK = Math.min(Math.max(input.topK ?? 6, 1), 12);

  // Query understanding: infer a target section (explicit filter wins).
  const inferredKind = input.filters?.sectionKind ?? inferSectionKind(input.question);

  const [kw, vec, sec] = await Promise.all([
    keywordSearch(input),
    vectorSearch(input),
    inferredKind ? sectionSearch(input, inferredKind) : Promise.resolve([]),
  ]);
  if (kw.length === 0 && vec.length === 0 && sec.length === 0) return [];

  // Section-intent matches are fused with extra weight (listed twice).
  const fused = reciprocalRankFusion(sec.length ? [sec, sec, kw, vec] : [kw, vec]).slice(0, POOL);
  const ids = fused.map((f) => f.id);
  if (ids.length === 0) return [];

  const chunks = await prisma.documentChunk.findMany({
    where: { id: { in: ids } },
    include: { caseDecision: { select: { nomorPutusan: true } } },
  });
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const kwIds = new Set(kw.map((x) => x.id));
  const vecIds = new Set(vec.map((x) => x.id));

  let evidence: RetrievedEvidence[] = [];
  for (const f of fused) {
    const c = byId.get(f.id);
    if (!c) continue;
    const source: RetrievedEvidence["source"] =
      kwIds.has(f.id) && vecIds.has(f.id) ? "hybrid" : vecIds.has(f.id) ? "vector" : "keyword";
    evidence.push({
      sourceId: c.id,
      chunkId: c.id,
      caseDecisionId: c.caseDecisionId,
      score: f.score,
      source,
      text: c.text,
      caseNumber: c.caseDecision?.nomorPutusan ?? null,
      title: c.caseDecision?.nomorPutusan ?? null,
      sectionTitle: c.sectionTitle,
      sectionKind: c.sectionKind,
      pageStart: c.pageStart,
      pageEnd: c.pageEnd,
      paragraphStart: c.paragraphStart,
      paragraphEnd: c.paragraphEnd,
      metadata: { legalTerms: fromJsonList(c.legalTermsJson), citedArticles: fromJsonList(c.citedArticlesJson) },
    });
  }

  // Optional reranking (no-op unless configured).
  evidence = await rerank(input.question, evidence);

  return evidence.slice(0, finalK);
}
