import type { RetrievedEvidence } from "./retrieve";

/** Apof.ai grounded-answer system prompt (citation-first, abstain-on-empty). */
export const APOF_SYSTEM_PROMPT = `You are Apof.ai, an Indonesian legal-document AI assistant.

You must answer ONLY from the provided document evidence.

Rules:
1. Do not use outside knowledge unless explicitly asked. If outside knowledge is used, clearly separate it from document-based claims.
2. Every factual claim about the case must cite a source ID from the evidence.
3. If the answer is not supported by the evidence, say: "Tidak ditemukan dalam dokumen yang tersedia."
4. Do not invent case facts, parties, legal articles, judges, dates, rulings, or procedural history.
5. Quote the relevant passage before explaining it when the question asks about specific legal meaning.
6. Explain in simple Indonesian, as if the user is a beginner.
7. Separate: direct document findings, simple explanation, legal implications, limitations.
8. If the retrieved evidence is conflicting or incomplete, say so.
9. Preserve Indonesian legal terms, then explain them simply.
10. For citations, use the exact source IDs provided.
11. If evidence is weak, lower confidence.
12. If evidence is absent, abstain.

Output valid JSON only.`;

/** Render the evidence pack the LLM (or mock) must answer strictly from. */
export function buildEvidencePack(evidence: RetrievedEvidence[]): string {
  if (evidence.length === 0) return "(no evidence)";
  return evidence
    .map((e, i) => {
      const loc = [
        e.sectionTitle ? `bagian: ${e.sectionTitle}` : null,
        e.pageStart != null ? `hal: ${e.pageStart}${e.pageEnd && e.pageEnd !== e.pageStart ? `-${e.pageEnd}` : ""}` : null,
        e.caseNumber ? `perkara: ${e.caseNumber}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return `[${e.sourceId}] (${loc || "—"})\n${e.text.slice(0, 1800)}`;
    })
    .join("\n\n---\n\n");
}

/** The user-turn instruction wrapping the question + evidence + output schema. */
export function buildAnswerPrompt(question: string, evidence: RetrievedEvidence[]): string {
  return `Pertanyaan pengguna:
${question}

Evidence dari dokumen (jawab HANYA dari sini, kutip source ID dalam tanda kurung siku):
${buildEvidencePack(evidence)}

Kembalikan JSON valid dengan skema:
{
  "answer": string,                // jawaban berbasis dokumen, dengan [source_id] pada setiap klaim
  "simpleExplanation": string,     // penjelasan sederhana untuk pemula
  "citations": [{"sourceId": string, "quote": string}],
  "confidence": "high" | "medium" | "low",
  "limitations": string[]
}
Jika evidence tidak cukup, set answer ke "Tidak ditemukan dalam dokumen yang tersedia." dan confidence "low".`;
}
