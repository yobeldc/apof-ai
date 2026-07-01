import { quoteSupported } from "./verify";

/**
 * RAG evaluation metrics — pure functions so they're unit-testable without a DB.
 * The scorer script (scripts/eval-rag.ts) feeds real retrieval/answer output in.
 */

export type EvalItem = {
  id: string;
  caseDecisionId?: string;
  question: string;
  expectedEvidenceContains?: string[];
  expectedAnswerContains?: string[];
  expectNotFound?: boolean;
  category?: string;
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ");

/** Recall@k: fraction of expected evidence snippets present in the top-k texts. */
export function recallAtK(retrievedTexts: string[], expected: string[], k: number): number {
  if (expected.length === 0) return 1;
  const hay = norm(retrievedTexts.slice(0, k).join(" \n "));
  const found = expected.filter((e) => hay.includes(norm(e))).length;
  return found / expected.length;
}

/** Mean reciprocal rank: 1/rank of the first text matching any expected snippet. */
export function reciprocalRank(retrievedTexts: string[], expected: string[]): number {
  if (expected.length === 0) return 1;
  for (let i = 0; i < retrievedTexts.length; i++) {
    const t = norm(retrievedTexts[i]);
    if (expected.some((e) => t.includes(norm(e)))) return 1 / (i + 1);
  }
  return 0;
}

/** Fraction of citations whose sourceId exists in the evidence set. */
export function citationSupportRate(
  citations: { sourceId: string }[],
  evidenceIds: Set<string>,
): number {
  if (citations.length === 0) return 1;
  const ok = citations.filter((c) => evidenceIds.has(c.sourceId)).length;
  return ok / citations.length;
}

/** Fraction of citations whose quote approximately appears in its cited chunk. */
export function quoteSupportRate(
  citations: { sourceId: string; quote: string }[],
  textById: Map<string, string>,
): number {
  if (citations.length === 0) return 1;
  const ok = citations.filter((c) => {
    const text = textById.get(c.sourceId);
    return text ? quoteSupported(c.quote, text) : false;
  }).length;
  return ok / citations.length;
}

/** Did abstention match expectation? */
export function notFoundCorrect(expected: boolean | undefined, got: boolean): boolean {
  if (expected === undefined) return !got; // by default we expect an answer
  return expected === got;
}

/** Fraction of expected answer terms present in the answer text. */
export function answerTermMatch(answer: string, expected: string[] | undefined): number {
  if (!expected || expected.length === 0) return 1;
  const hay = norm(answer);
  return expected.filter((t) => hay.includes(norm(t))).length / expected.length;
}

export type EvalScore = {
  id: string;
  category?: string;
  recallAtK: number;
  mrr: number;
  citationSupport: number;
  quoteSupport: number;
  notFoundCorrect: boolean;
  answerMatch: number;
};

export function aggregate(scores: EvalScore[]) {
  const n = scores.length || 1;
  const mean = (sel: (s: EvalScore) => number) => scores.reduce((a, s) => a + sel(s), 0) / n;
  return {
    count: scores.length,
    recallAtK: mean((s) => s.recallAtK),
    mrr: mean((s) => s.mrr),
    citationSupport: mean((s) => s.citationSupport),
    quoteSupport: mean((s) => s.quoteSupport),
    notFoundAccuracy: scores.filter((s) => s.notFoundCorrect).length / n,
    answerMatch: mean((s) => s.answerMatch),
  };
}
