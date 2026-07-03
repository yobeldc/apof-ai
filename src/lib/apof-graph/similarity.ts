/**
 * Explainable case similarity computation for Apof Graph.
 *
 * Combines shared legal issues, cited articles, judges, outcome match,
 * and optional semantic similarity into a composite score.
 */

import { prisma } from "../db";

export interface SimilarityResult {
  similarCaseId: string;
  score: number;
  explanation: {
    sharedLegalIssues: string[];
    sharedArticles: string[];
    sharedJudges: string[];
    outcomeMatch: boolean;
    semanticSimilarity: number | null;
    compositeScore: number;
  };
}

/**
 * Find similar cases to the given case.
 */
export async function findSimilarCases(
  caseDecisionId: string,
  limit: number = 5
): Promise<SimilarityResult[]> {
  // Get source case extraction
  const sourceExtraction = await prisma.apofGraphExtraction.findUnique({
    where: { caseDecisionId },
  });

  if (!sourceExtraction) return [];

  const sourceData = JSON.parse(sourceExtraction.fullJson);
  const sourceIssues = new Set((sourceData.legal_issues ?? []).map((i: { issue: string }) => i.issue));
  const sourceArticles = new Set((sourceData.cited_articles ?? []).map((a: { statute: string; article: string }) => `${a.statute}:${a.article}`));
  const sourceJudges = new Set((sourceData.majelis_hakim ?? []).map((j: { name: string }) => j.name));
  const sourceOutcome = sourceData.outcome;

  // Get all other extracted cases
  const allExtractions = await prisma.apofGraphExtraction.findMany({
    where: { NOT: { caseDecisionId } },
    include: { caseDecision: { select: { nomorPutusan: true, pengadilan: true, tahun: true } } },
  });

  const results: SimilarityResult[] = [];

  for (const candidate of allExtractions) {
    const cData = JSON.parse(candidate.fullJson);
    const cIssues = new Set((cData.legal_issues ?? []).map((i: { issue: string }) => i.issue));
    const cArticles = new Set((cData.cited_articles ?? []).map((a: { statute: string; article: string }) => `${a.statute}:${a.article}`));
    const cJudges = new Set((cData.majelis_hakim ?? []).map((j: { name: string }) => j.name));

    const sharedIssues = [...sourceIssues].filter((x) => cIssues.has(x));
    const sharedArticles = [...sourceArticles].filter((x) => cArticles.has(x));
    const sharedJudges = [...sourceJudges].filter((x) => cJudges.has(x));
    const outcomeMatch = sourceOutcome === cData.outcome;

    const score = computeSimilarityScore({
      sharedIssues: sharedIssues.length,
      totalIssues: Math.max(sourceIssues.size, cIssues.size, 1),
      sharedArticles: sharedArticles.length,
      totalArticles: Math.max(sourceArticles.size, cArticles.size, 1),
      sharedJudges: sharedJudges.length,
      totalJudges: Math.max(sourceJudges.size, cJudges.size, 1),
      outcomeMatch,
      semanticSimilarity: null,
    });

    results.push({
      similarCaseId: candidate.caseDecisionId,
      score,
      explanation: {
        sharedLegalIssues: sharedIssues,
        sharedArticles: sharedArticles,
        sharedJudges: sharedJudges,
        outcomeMatch,
        semanticSimilarity: null,
        compositeScore: score,
      },
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/**
 * Compute a composite similarity score from components.
 */
export function computeSimilarityScore(components: {
  sharedIssues: number;
  totalIssues: number;
  sharedArticles: number;
  totalArticles: number;
  sharedJudges: number;
  totalJudges: number;
  outcomeMatch: boolean;
  semanticSimilarity: number | null;
}): number {
  const issueScore = components.sharedIssues / components.totalIssues;
  const articleScore = components.sharedArticles / components.totalArticles;
  const judgeScore = components.sharedJudges / components.totalJudges;
  const outcomeScore = components.outcomeMatch ? 1 : 0;
  const semanticScore = components.semanticSimilarity ?? 0;

  // Weighted combination
  return (
    issueScore * 0.35 +
    articleScore * 0.25 +
    judgeScore * 0.15 +
    outcomeScore * 0.1 +
    semanticScore * 0.15
  );
}

/**
 * Build similarity matrix for all cases.
 */
export async function buildSimilarityMatrix(): Promise<{ computed: number; timeMs: number }> {
  const start = Date.now();
  const extractions = await prisma.apofGraphExtraction.findMany();
  let computed = 0;

  for (const source of extractions) {
    const similar = await findSimilarCases(source.caseDecisionId, 10);
    for (const s of similar) {
      await prisma.decisionSimilarity.upsert({
        where: {
          caseDecisionId_similarCaseDecisionId: {
            caseDecisionId: source.caseDecisionId,
            similarCaseDecisionId: s.similarCaseId,
          },
        },
        create: {
          caseDecisionId: source.caseDecisionId,
          similarCaseDecisionId: s.similarCaseId,
          score: s.score,
          explanationJson: JSON.stringify(s.explanation),
          sharedIssueIdsJson: JSON.stringify(s.explanation.sharedLegalIssues),
          sharedArticleIdsJson: JSON.stringify(s.explanation.sharedArticles),
        },
        update: {
          score: s.score,
          explanationJson: JSON.stringify(s.explanation),
          sharedIssueIdsJson: JSON.stringify(s.explanation.sharedLegalIssues),
          sharedArticleIdsJson: JSON.stringify(s.explanation.sharedArticles),
        },
      });
      computed++;
    }
  }

  return { computed, timeMs: Date.now() - start };
}

/**
 * Get cached similarity results.
 */
export async function getCachedSimilarity(caseDecisionId: string): Promise<SimilarityResult[]> {
  const rows = await prisma.decisionSimilarity.findMany({
    where: { caseDecisionId },
    orderBy: { score: "desc" },
    take: 5,
  });

  return rows.map((r) => ({
    similarCaseId: r.similarCaseDecisionId,
    score: r.score,
    explanation: JSON.parse(r.explanationJson),
  }));
}
