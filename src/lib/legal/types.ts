/**
 * Normalized internal representation of an Indonesian legal decision.
 * Deterministic-first: nothing here is invented — unknown fields are null and
 * undetected sections are labeled "unknown".
 */

export type LegalSectionKind =
  | "case_identity"
  | "procedural_history"
  | "parties"
  | "facts"
  | "legal_issues"
  | "legal_basis"
  | "claimant_arguments"
  | "respondent_arguments"
  | "court_reasoning"
  | "final_ruling"
  | "ratio_decidendi"
  | "obiter_dicta"
  | "legal_consequences"
  | "timeline"
  | "glossary_candidates"
  | "unknown";

export type LegalSection = {
  kind: LegalSectionKind;
  title: string | null;
  /** Character offset range within the cleaned document text. */
  start: number;
  end: number;
  text: string;
  /** Page numbers this section spans, if page boundaries are known. */
  pageStart: number | null;
  pageEnd: number | null;
  confidence: number; // 0..1 — 1 for a matched heading, lower for heuristics
};

export type NormalizedLegalDocument = {
  caseDecisionId: string;
  sourceUrl: string | null;
  originalFilename: string | null;

  // Identity (carried from CaseDecision when available — never invented here).
  caseNumber: string | null;
  courtLevel: string | null;
  courtName: string | null;
  decisionDate: string | null;
  importDate: string | null;
  judges: string[];
  parties: string[];
  classification: string | null;
  legalArticles: string[];

  // Structure.
  pageCount: number;
  rawText: string;
  cleanedText: string;
  sections: LegalSection[];

  extractionStatus: string;
  extractionConfidence: number;
  warnings: string[];
};

/** Cited legal articles (e.g. "Pasal 378 KUHP", "Pasal 1365 KUHPerdata"). */
export const ARTICLE_REGEX = /Pasal\s+\d+[A-Za-z]?(?:\s+ayat\s*\(\d+\))?(?:\s+(?:KUHP|KUHPerdata|KUHAP|UU(?:\s+No\.?\s*\d+(?:\/\d+)?)?))?/gi;
