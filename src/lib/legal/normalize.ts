import { ARTICLE_REGEX, type NormalizedLegalDocument } from "./types";
import { detectSections } from "./sections";
import { fromJsonList } from "../serialize";

/**
 * Normalize an extracted document + its CaseDecision row into the internal
 * legal representation: identity metadata (carried, never invented) + cleaned
 * text + detected sections. Deterministic and side-effect free.
 */

/** Light cleaning for indexing/search — preserves meaning, collapses noise. */
export function cleanLegalText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/(\w)-\n(\w)/g, "$1$2") // de-hyphenate line breaks
    .trim();
}

export function extractCitedArticles(text: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  ARTICLE_REGEX.lastIndex = 0;
  while ((m = ARTICLE_REGEX.exec(text)) !== null) {
    out.add(m[0].replace(/\s+/g, " ").trim());
  }
  return Array.from(out);
}

type CaseRow = {
  id: string;
  sourceUrl: string | null;
  nomorPutusan: string | null;
  tingkatProses: string | null;
  pengadilan: string | null;
  lembagaPeradilan: string | null;
  tanggalPutusan: string | null;
  klasifikasi: string | null;
  hakim: string | null; // JSON string[]
  pihak: string | null; // JSON string[]
  fullText: string | null;
  createdAt: Date | string;
  extractionStatus: string;
};

export function normalizeDocument(
  caseRow: CaseRow,
  pages: { pageNumber: number; text: string; confidence?: number | null }[],
  opts: { originalFilename?: string | null; warnings?: string[] } = {},
): NormalizedLegalDocument {
  const warnings = [...(opts.warnings ?? [])];

  // Build a single cleaned text with page boundary offsets for citations.
  const orderedPages = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);
  let rawText = "";
  const boundaries: { pageNumber: number; start: number }[] = [];
  for (const p of orderedPages) {
    boundaries.push({ pageNumber: p.pageNumber, start: rawText.length });
    rawText += (rawText ? "\n\n" : "") + p.text;
  }
  if (!rawText && caseRow.fullText) {
    rawText = caseRow.fullText;
    boundaries.push({ pageNumber: 1, start: 0 });
    warnings.push("No page records — fell back to CaseDecision.fullText as a single page.");
  }

  const cleanedText = cleanLegalText(rawText);
  // Re-map boundaries onto cleaned text is approximate; for cleanliness we
  // recompute boundaries by proportional offset only when lengths differ a lot.
  const sections = detectSections(cleanedText, boundaries.map((b) => ({
    pageNumber: b.pageNumber,
    start: Math.min(b.start, cleanedText.length),
  })));

  const legalArticles = extractCitedArticles(cleanedText);
  const confidences = orderedPages.map((p) => p.confidence ?? 1);
  const extractionConfidence = confidences.length
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : caseRow.fullText
      ? 0.5
      : 0;

  if (sections.length === 0) warnings.push("No legal sections detected.");

  return {
    caseDecisionId: caseRow.id,
    sourceUrl: caseRow.sourceUrl,
    originalFilename: opts.originalFilename ?? null,
    caseNumber: caseRow.nomorPutusan,
    courtLevel: caseRow.tingkatProses,
    courtName: caseRow.pengadilan ?? caseRow.lembagaPeradilan,
    decisionDate: caseRow.tanggalPutusan,
    importDate: caseRow.createdAt instanceof Date ? caseRow.createdAt.toISOString() : String(caseRow.createdAt),
    judges: fromJsonList(caseRow.hakim),
    parties: fromJsonList(caseRow.pihak),
    classification: caseRow.klasifikasi,
    legalArticles,
    pageCount: orderedPages.length || (caseRow.fullText ? 1 : 0),
    rawText,
    cleanedText,
    sections,
    extractionStatus: caseRow.extractionStatus,
    extractionConfidence,
    warnings,
  };
}
