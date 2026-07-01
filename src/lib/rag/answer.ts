import { z } from "zod";
import { prisma } from "../db";
import { env } from "../env";
import { retrieveEvidence, meaningfulTerms, inferSectionKind, type RagSearchInput, type RetrievedEvidence } from "./retrieve";
import { getLlmProvider, isMockLlm } from "./llm";
import { isMockEmbeddings } from "./embeddings";
import { verifyCitations } from "./verify";

const MOCK_RELEVANCE_FLOOR = 0.34;

/**
 * Mock-mode relevance gate. With no real semantics, we abstain when a question
 * neither maps to a known legal section (query understanding) NOR shares enough
 * meaningful terms with the retrieved evidence. This makes out-of-scope questions
 * correctly return "Tidak ditemukan…" while in-scope legal questions get through.
 */
function isUngroundedInMockMode(question: string, evidence: RetrievedEvidence[]): boolean {
  if (inferSectionKind(question)) return false; // intent matched a legal section
  const terms = meaningfulTerms(question);
  if (terms.length === 0) return false;
  const haystack = evidence.map((e) => e.text.toLowerCase()).join(" ");
  const present = terms.filter((t) => haystack.includes(t)).length;
  return present / terms.length < MOCK_RELEVANCE_FLOOR;
}

/** Final grounded answer returned to the UI. */
export type RagAnswer = {
  answer: string;
  simpleExplanation: string;
  citations: Array<{
    sourceId: string;
    chunkId: string;
    caseDecisionId: string;
    quote: string;
    pageStart?: number | null;
    pageEnd?: number | null;
    sectionTitle?: string | null;
    sectionKind?: string | null;
  }>;
  evidence: RetrievedEvidence[];
  notFound: boolean;
  confidence: "high" | "medium" | "low";
  limitations: string[];
};

export const ragAnswerSchema = z.object({
  answer: z.string(),
  simpleExplanation: z.string(),
  citations: z.array(
    z.object({
      sourceId: z.string(),
      chunkId: z.string(),
      caseDecisionId: z.string(),
      quote: z.string(),
      pageStart: z.number().nullable().optional(),
      pageEnd: z.number().nullable().optional(),
      sectionTitle: z.string().nullable().optional(),
      sectionKind: z.string().nullable().optional(),
    }),
  ),
  evidence: z.array(z.any()),
  notFound: z.boolean(),
  confidence: z.enum(["high", "medium", "low"]),
  limitations: z.array(z.string()),
});

export const NOT_FOUND_ANSWER: Omit<RagAnswer, "evidence"> = {
  answer: "Tidak ditemukan dalam dokumen yang tersedia.",
  simpleExplanation: "Apof.ai belum menemukan bagian dokumen yang cukup relevan untuk menjawab pertanyaan ini.",
  citations: [],
  notFound: true,
  confidence: "low",
  limitations: ["Tidak ada evidence yang cukup relevan dari dokumen yang tersedia."],
};

/**
 * Full grounded-answer workflow: retrieve → generate → verify citations →
 * downgrade/abstain → log. Always returns a schema-valid RagAnswer.
 */
export async function answerQuestion(input: RagSearchInput): Promise<RagAnswer> {
  const evidence = await retrieveEvidence(input);

  // Abstain when there is no evidence, or — in mock mode (no real semantics) —
  // when the question has no lexical grounding in the retrieved chunks.
  const mockMode = isMockEmbeddings() || isMockLlm();
  if (evidence.length === 0 || (mockMode && isUngroundedInMockMode(input.question, evidence))) {
    const result: RagAnswer = { ...NOT_FOUND_ANSWER, evidence: [] };
    await logQuery(input, result, true);
    return result;
  }

  const provider = getLlmProvider();
  let raw;
  try {
    raw = await provider.generate(input.question, evidence);
  } catch (err) {
    // LLM unavailable (e.g. Ollama not running) → safe fallback, not a crash.
    const result: RagAnswer = {
      ...NOT_FOUND_ANSWER,
      answer: "Model jawaban tidak tersedia saat ini.",
      simpleExplanation:
        "Provider LLM (mis. Ollama) tidak dapat dihubungi. Evidence dokumen tetap ditampilkan di bawah untuk Anda baca langsung.",
      limitations: [`LLM provider error: ${err instanceof Error ? err.message : String(err)}`],
      evidence,
      notFound: false,
    };
    await logQuery(input, result, false);
    return result;
  }

  const verification = verifyCitations(raw.citations, evidence, raw.confidence);
  const isAbstain = raw.answer.trim().toLowerCase().startsWith("tidak ditemukan");

  const limitations = [...raw.limitations, ...verification.limitations];
  if (isMockLlm()) limitations.unshift("Mode pengembangan (mock): jawaban bersifat ekstraktif, bukan analisis cerdas.");

  const result: RagAnswer = {
    answer: raw.answer,
    simpleExplanation: raw.simpleExplanation,
    citations: verification.citations,
    evidence,
    notFound: isAbstain,
    confidence: verification.confidence,
    limitations: Array.from(new Set(limitations)),
  };

  // Validate our own output shape (defensive).
  ragAnswerSchema.parse(result);
  await logQuery(input, result, isAbstain);
  return result;
}

async function logQuery(input: RagSearchInput, result: RagAnswer, abstained: boolean) {
  try {
    await prisma.ragQueryLog.create({
      data: {
        question: input.question,
        filtersJson: JSON.stringify(input.filters ?? {}),
        retrievedJson: JSON.stringify(result.evidence.map((e) => ({ sourceId: e.sourceId, score: e.score, source: e.source }))),
        answer: result.answer.slice(0, 4000),
        abstained,
        provider: env.rag.llmProvider,
        model: env.rag.llmModel,
      },
    });
  } catch {
    /* logging must never break answering */
  }
}
