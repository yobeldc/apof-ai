import { prisma } from "../db";
import { env } from "../env";
import { extractFromRawHtmlPath, extractFromPdfPath } from "../document-extraction/extractor";
import type { ExtractedDocument } from "../document-extraction/types";
import { normalizeDocument } from "../legal/normalize";
import { chunkDocument } from "./chunk";
import { getEmbeddingProvider } from "./embeddings";
import { countEmbeddedChunks, getVectorStore, type VectorPoint } from "./vector-store";

/**
 * RAG indexing pipeline: extract pages → normalize → chunk → embed. Idempotent:
 * re-running skips chunks/embeddings that already exist unless `force`.
 */

export type IndexResult = {
  caseDecisionId: string;
  caseNumber: string | null;
  pages: number;
  chunks: number;
  embedded: number;
  skipped: boolean;
  warnings: string[];
};

const CASE_SELECT = {
  id: true, sourceUrl: true, nomorPutusan: true, tingkatProses: true, pengadilan: true,
  lembagaPeradilan: true, tanggalPutusan: true, klasifikasi: true, hakim: true, pihak: true,
  fullText: true, createdAt: true, extractionStatus: true, rawHtmlPath: true, localPdfPath: true,
} as const;

async function ensurePages(caseRow: {
  id: string; rawHtmlPath: string | null; localPdfPath: string | null; fullText: string | null;
}): Promise<{ count: number; warnings: string[] }> {
  const existing = await prisma.documentPage.count({ where: { caseDecisionId: caseRow.id } });
  if (existing > 0) return { count: existing, warnings: [] };

  let extracted: ExtractedDocument | null = null;
  if (caseRow.localPdfPath) extracted = await extractFromPdfPath(caseRow.localPdfPath);
  if ((!extracted || extracted.pages.length === 0) && caseRow.rawHtmlPath) {
    extracted = await extractFromRawHtmlPath(caseRow.rawHtmlPath);
  }
  const warnings = extracted?.warnings ?? [];
  let pages = extracted?.pages ?? [];
  if (pages.length === 0 && caseRow.fullText) {
    pages = [{ pageNumber: 1, text: caseRow.fullText, confidence: 0.5 }];
    warnings.push("No raw HTML/PDF on disk — used CaseDecision.fullText as a single page.");
  }
  pages = pages.filter((p) => p.text.trim().length > 0);
  if (pages.length === 0) return { count: 0, warnings: [...warnings, "No extractable text for this case."] };

  for (const p of pages) {
    await prisma.documentPage.upsert({
      where: { caseDecisionId_pageNumber: { caseDecisionId: caseRow.id, pageNumber: p.pageNumber } },
      update: { text: p.text, confidence: p.confidence ?? null },
      create: { caseDecisionId: caseRow.id, pageNumber: p.pageNumber, text: p.text, confidence: p.confidence ?? null },
    });
  }
  return { count: pages.length, warnings };
}

export async function indexCase(caseId: string, opts: { force?: boolean } = {}): Promise<IndexResult> {
  const caseRow = await prisma.caseDecision.findUnique({ where: { id: caseId }, select: CASE_SELECT });
  if (!caseRow) throw new Error(`Case ${caseId} not found`);

  const warnings: string[] = [];

  if (opts.force) {
    await prisma.documentChunk.deleteMany({ where: { caseDecisionId: caseId } }); // cascades embeddings
    await prisma.documentPage.deleteMany({ where: { caseDecisionId: caseId } });
  }

  const { count: pageCount, warnings: pageWarnings } = await ensurePages(caseRow);
  warnings.push(...pageWarnings);

  const pages = await prisma.documentPage.findMany({
    where: { caseDecisionId: caseId },
    orderBy: { pageNumber: "asc" },
    select: { pageNumber: true, text: true, confidence: true },
  });

  const existingChunks = await prisma.documentChunk.count({ where: { caseDecisionId: caseId } });
  if (existingChunks > 0 && !opts.force) {
    const embedded = await prisma.chunkEmbedding.count({
      where: { model: env.rag.embeddingModel, chunk: { caseDecisionId: caseId } },
    });
    if (embedded >= existingChunks) {
      return { caseDecisionId: caseId, caseNumber: caseRow.nomorPutusan, pages: pageCount, chunks: existingChunks, embedded, skipped: true, warnings };
    }
  }

  const doc = normalizeDocument(caseRow, pages, { warnings });
  const chunks = chunkDocument(doc);
  if (chunks.length === 0) {
    return { caseDecisionId: caseId, caseNumber: caseRow.nomorPutusan, pages: pageCount, chunks: 0, embedded: 0, skipped: false, warnings: [...warnings, "No chunks produced."] };
  }

  // Upsert chunks (deterministic IDs ⇒ idempotent).
  for (const c of chunks) {
    await prisma.documentChunk.upsert({
      where: { id: c.id },
      update: {
        text: c.text, normalizedText: c.normalizedText, sectionTitle: c.sectionTitle ?? null,
        sectionKind: c.sectionKind ?? null, parentSection: c.parentSection ?? null,
        pageStart: c.pageStart ?? null, pageEnd: c.pageEnd ?? null, chunkIndex: c.chunkIndex,
        legalTermsJson: JSON.stringify(c.legalTerms), citedArticlesJson: JSON.stringify(c.citedArticles),
        metadataJson: JSON.stringify({ parties: c.partiesMentioned, judges: c.judgesMentioned }),
      },
      create: {
        id: c.id, caseDecisionId: c.caseDecisionId, chunkIndex: c.chunkIndex,
        parentSection: c.parentSection ?? null, sectionTitle: c.sectionTitle ?? null, sectionKind: c.sectionKind ?? null,
        pageStart: c.pageStart ?? null, pageEnd: c.pageEnd ?? null, paragraphStart: c.paragraphStart ?? null, paragraphEnd: c.paragraphEnd ?? null,
        text: c.text, normalizedText: c.normalizedText,
        legalTermsJson: JSON.stringify(c.legalTerms), citedArticlesJson: JSON.stringify(c.citedArticles),
        metadataJson: JSON.stringify({ parties: c.partiesMentioned, judges: c.judgesMentioned }),
      },
    });
  }

  // Embed chunks missing an embedding for the active model.
  const provider = getEmbeddingProvider();
  const needEmbedding = [];
  for (const c of chunks) {
    const has = await prisma.chunkEmbedding.findUnique({
      where: { chunkId_provider_model: { chunkId: c.id, provider: provider.provider, model: provider.model } },
      select: { id: true },
    });
    if (!has || opts.force) needEmbedding.push(c);
  }
  if (needEmbedding.length) {
    let results;
    try {
      results = await provider.embedDocuments(needEmbedding.map((c) => ({ id: c.id, text: c.text })));
    } catch (err) {
      // e.g. Ollama not running. Chunks are stored; embeddings can be retried later.
      const msg = `Embedding provider '${provider.provider}/${provider.model}' unavailable: ${err instanceof Error ? err.message : String(err)}`;
      const embedded = await prisma.chunkEmbedding.count({ where: { model: env.rag.embeddingModel, chunk: { caseDecisionId: caseId } } });
      return { caseDecisionId: caseId, caseNumber: caseRow.nomorPutusan, pages: pageCount, chunks: chunks.length, embedded, skipped: false, warnings: [...warnings, msg] };
    }
    const byChunkId = new Map(needEmbedding.map((c) => [c.id, c]));
    for (const r of results) {
      await prisma.chunkEmbedding.upsert({
        where: { chunkId_provider_model: { chunkId: r.id, provider: r.provider, model: r.model } },
        update: { vectorJson: JSON.stringify(r.vector), dimensions: r.dimensions },
        create: { chunkId: r.id, provider: r.provider, model: r.model, dimensions: r.dimensions, vectorJson: JSON.stringify(r.vector) },
      });
    }
    // Push to the active vector store (no-op for SQLite; populates Qdrant).
    const store = getVectorStore();
    if (store.upsert) {
      const points: VectorPoint[] = results.map((r) => {
        const c = byChunkId.get(r.id)!;
        return {
          chunkId: r.id,
          vector: r.vector,
          payload: {
            caseDecisionId: caseId,
            caseNumber: caseRow.nomorPutusan,
            sectionKind: c.sectionKind ?? null,
            sectionTitle: c.sectionTitle ?? null,
            pageStart: c.pageStart ?? null,
            pageEnd: c.pageEnd ?? null,
          },
        };
      });
      await store.upsert(points).catch((err) => console.warn("[rag] vector upsert failed:", err));
    }
  }

  const embedded = await prisma.chunkEmbedding.count({
    where: { model: env.rag.embeddingModel, chunk: { caseDecisionId: caseId } },
  });
  return { caseDecisionId: caseId, caseNumber: caseRow.nomorPutusan, pages: pageCount, chunks: chunks.length, embedded, skipped: false, warnings };
}

export async function indexAllCases(opts: { force?: boolean } = {}): Promise<IndexResult[]> {
  const cases = await prisma.caseDecision.findMany({ select: { id: true } });
  const results: IndexResult[] = [];
  for (const c of cases) results.push(await indexCase(c.id, opts));
  return results;
}

export async function getRagStatus() {
  const [cases, pages, chunks, embedded] = await Promise.all([
    prisma.caseDecision.count(),
    prisma.documentPage.count(),
    prisma.documentChunk.count(),
    countEmbeddedChunks(),
  ]);

  const warnings: string[] = [];
  const suggestions: string[] = [];
  if (env.rag.embeddingProvider === "mock") {
    warnings.push("Embedding provider is MOCK (development only — not semantically strong).");
    suggestions.push("Set RAG_EMBEDDING_PROVIDER=ollama and run `ollama pull bge-m3` for real embeddings.");
  }
  if (env.rag.llmProvider === "mock") {
    warnings.push("LLM provider is MOCK (deterministic extractive answers).");
    suggestions.push("Set RAG_LLM_PROVIDER=ollama and run `ollama pull qwen3:8b` for grounded generation.");
  }
  if (chunks === 0) suggestions.push("No chunks yet — run `npm run rag:index` (or POST /api/rag/index).");
  else if (embedded < chunks) suggestions.push(`${chunks - embedded} chunks not embedded for the active model — run \`npm run rag:index\`.`);

  return {
    enabled: env.rag.enabled,
    embeddingProvider: env.rag.embeddingProvider,
    embeddingModel: env.rag.embeddingModel,
    embeddingDimension: env.rag.embeddingDimension || "auto",
    vectorProvider: env.rag.vectorProvider,
    rerankerProvider: env.rag.rerankerProvider,
    llmProvider: env.rag.llmProvider,
    llmModel: env.rag.llmModel,
    counts: { cases, pages, chunks, embeddedChunks: embedded },
    warnings,
    suggestions,
  };
}
