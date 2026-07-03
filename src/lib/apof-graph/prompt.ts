/**
 * LLM prompt templates for Apof Graph extraction and memo generation.
 *
 * Conservative rules: unknown > invented, evidence required, cite source spans.
 */

import type { ApofGraphDecisionExtraction } from "./schema";

export const EXTRACTION_PROMPT_VERSION = "1.0.0";
export const MEMO_PROMPT_VERSION = "1.0.0";

export const CONSERVATIVE_RULES = `
CRITICAL RULES:
1. If information is not present in the text, return null. Do NOT invent.
2. Every non-null field must include a source span (paragraph number or quote).
3. Use Indonesian legal terminology accurately.
4. Do not provide legal advice or predict outcomes.
5. Unknown > invented. When in doubt, mark as unsupported.
6. For monetary values, always include currency (IDR or USD).
7. Normalize judge names to official court formats.
8. Statute citations should use standard Indonesian format (e.g., "UU No. 8 Tahun 2010").
` as const;

export const EVIDENCE_REQUIREMENTS = `
EVIDENCE REQUIREMENTS:
For each extracted field, provide:
- target_path: the field path (e.g., "sentence.type")
- quote: the exact text span supporting the extraction (50-200 chars)
- source: the document source (paragraph number or section name)
` as const;

/**
 * Build an extraction prompt for the LLM.
 */
export function buildExtractionPrompt(
  caseText: string,
  partialExtraction: Partial<ApofGraphDecisionExtraction>
): string {
  const partialJson = JSON.stringify(partialExtraction, null, 2);

  return `You are a legal document analysis assistant specialized in Indonesian court decisions.

${CONSERVATIVE_RULES}
${EVIDENCE_REQUIREMENTS}

TASK: Extract structured legal data from the following Indonesian court decision.

Some fields have already been extracted deterministically (shown below).
Fill in the remaining fields, especially interpretive ones:
- legal_issues
- ratio_decidendi
- arguments
- judicial_considerations
- chronology_facts
- charges
- precedent_citations
- banking_fraud_specific
- tppu_specific

ALREADY EXTRACTED (do not change):
${partialJson}

COURT DECISION TEXT:
---
${caseText.slice(0, 8000)}
---

Respond with valid JSON matching the extraction schema. Only include fields you have high confidence in. Set uncertain fields to null.
`;
}

/**
 * Build a memo generation prompt.
 */
export function buildMemoPrompt(
  extractions: ApofGraphDecisionExtraction[],
  focus?: string[]
): string {
  const focusText = focus && focus.length > 0
    ? `Focus on these issues: ${focus.join(", ")}`
    : "Provide a comprehensive overview.";

  return `You are a legal research assistant. Generate a factual research memo based on the following extracted case data.

${CONSERVATIVE_RULES}

RULES:
- Every factual claim must cite the source case by nomor_putusan
- Include uncertainty warnings for low-confidence extractions
- Do not provide legal advice or recommendations
- Present descriptive analysis only

${focusText}

EXTRACTED CASE DATA:
${JSON.stringify(extractions, null, 2).slice(0, 10000)}

Generate a structured research memo with sections: Overview, Legal Issues, Key Holdings, Sentencing Patterns, Similarities, Limitations.
`;
}
