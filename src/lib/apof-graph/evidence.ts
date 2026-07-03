/**
 * Evidence span resolution for Apof Graph extractions.
 *
 * Maps extracted fields back to their source text in DocumentChunk,
 * DocumentPage, or CaseDecision.fullText.
 */

import { prisma } from "../db";
import type { ApofGraphEvidenceSpan } from "./schema";

/**
 * Resolve evidence spans for a given case and field by searching
 * DocumentChunk, DocumentPage, and CaseDecision.fullText.
 */
export async function resolveEvidenceSpans(
  caseDecisionId: string,
  fieldPath: string,
  searchTerms: string[]
): Promise<ApofGraphEvidenceSpan[]> {
  const spans: ApofGraphEvidenceSpan[] = [];

  // 1. Search DocumentChunk
  const chunks = await prisma.documentChunk.findMany({
    where: { caseDecisionId },
  });

  for (const chunk of chunks) {
    for (const term of searchTerms) {
      const idx = chunk.text.toLowerCase().indexOf(term.toLowerCase());
      if (idx !== -1) {
        const quote = chunk.text.slice(Math.max(0, idx - 50), idx + term.length + 50);
        spans.push({
          target_path: fieldPath,
          chunk_id: chunk.id,
          source_id: `chunk:${chunk.id}`,
          page_start: null,
          page_end: null,
          paragraph_start: null,
          paragraph_end: null,
          quote,
        });
      }
    }
  }

  if (spans.length > 0) return spans;

  // 2. Fallback: search DocumentPage
  const pages = await prisma.documentPage.findMany({
    where: { caseDecisionId },
  });

  for (const page of pages) {
    for (const term of searchTerms) {
      const idx = page.text.toLowerCase().indexOf(term.toLowerCase());
      if (idx !== -1) {
        const quote = page.text.slice(Math.max(0, idx - 50), idx + term.length + 50);
        spans.push({
          target_path: fieldPath,
          chunk_id: null,
          source_id: `page:${page.id}`,
          page_start: page.pageNumber,
          page_end: page.pageNumber,
          paragraph_start: null,
          paragraph_end: null,
          quote,
        });
      }
    }
  }

  if (spans.length > 0) return spans;

  // 3. Fallback: search CaseDecision.fullText
  const caseDecision = await prisma.caseDecision.findUnique({
    where: { id: caseDecisionId },
    select: { fullText: true },
  });

  if (caseDecision?.fullText) {
    for (const term of searchTerms) {
      const idx = caseDecision.fullText.toLowerCase().indexOf(term.toLowerCase());
      if (idx !== -1) {
        const quote = caseDecision.fullText.slice(Math.max(0, idx - 50), idx + term.length + 50);
        spans.push({
          target_path: fieldPath,
          chunk_id: null,
          source_id: `caseDecision:${caseDecisionId}`,
          page_start: null,
          page_end: null,
          paragraph_start: null,
          paragraph_end: null,
          quote,
        });
      }
    }
  }

  return spans;
}

/**
 * Filter evidence spans by field path prefix.
 */
export function evidenceForField(
  spans: ApofGraphEvidenceSpan[],
  fieldPath: string
): ApofGraphEvidenceSpan[] {
  return spans.filter((s) => s.target_path === fieldPath || s.target_path.startsWith(`${fieldPath}.`));
}

/**
 * Check if any evidence span exists for a field.
 */
export function hasEvidence(spans: ApofGraphEvidenceSpan[], fieldPath: string): boolean {
  return evidenceForField(spans, fieldPath).length > 0;
}

/**
 * Compute a rough overall confidence score from evidence spans.
 * Returns 0 if no spans, otherwise a heuristic based on quote length.
 */
export function overallConfidence(spans: ApofGraphEvidenceSpan[]): number {
  if (spans.length === 0) return 0;
  const avgQuoteLen = spans.reduce((sum, s) => sum + s.quote.length, 0) / spans.length;
  return Math.min(1, avgQuoteLen / 200);
}
