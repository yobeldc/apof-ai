import { env } from "../env";
import { APOF_SYSTEM_PROMPT, buildAnswerPrompt } from "./prompts";
import type { RetrievedEvidence } from "./retrieve";

/**
 * Answer-generation LLM providers: mock | ollama | custom_http.
 * The MOCK provider is deterministic and extractive — it does NOT pretend to be
 * intelligent; it stitches together the top evidence and is clearly dev-only.
 */

export type RawAnswer = {
  answer: string;
  simpleExplanation: string;
  citations: Array<{ sourceId: string; quote?: string }>;
  confidence: "high" | "medium" | "low";
  limitations: string[];
};

export interface LlmAnswerProvider {
  readonly provider: string;
  readonly model: string;
  generate(question: string, evidence: RetrievedEvidence[]): Promise<RawAnswer>;
}

// ---------------------------------------------------------------------------
// MOCK — deterministic extractive answer. Dev-only.
// ---------------------------------------------------------------------------
class MockLlmProvider implements LlmAnswerProvider {
  provider = "mock";
  model = env.rag.llmModel || "mock-answer-v1";
  async generate(question: string, evidence: RetrievedEvidence[]): Promise<RawAnswer> {
    if (evidence.length === 0) {
      return {
        answer: "Tidak ditemukan dalam dokumen yang tersedia.",
        simpleExplanation: "Apof.ai belum menemukan bagian dokumen yang cukup relevan untuk menjawab pertanyaan ini.",
        citations: [],
        confidence: "low",
        limitations: ["Tidak ada evidence yang cukup relevan dari dokumen yang tersedia."],
      };
    }
    const top = evidence.slice(0, 3);
    const findings = top
      .map((e) => `Menurut ${e.sectionTitle ?? "dokumen"} [${e.sourceId}]: "${e.text.slice(0, 220).trim()}…"`)
      .join("\n\n");
    return {
      answer: `Berdasarkan dokumen yang tersedia:\n\n${findings}`,
      simpleExplanation:
        "(Jawaban mode pengembangan/mock — bersifat ekstraktif, bukan analisis cerdas.) " +
        "Ini adalah kutipan bagian dokumen yang paling relevan dengan pertanyaan Anda. " +
        "Aktifkan provider LLM lokal (Ollama) untuk penjelasan yang lebih baik.",
      citations: top.map((e) => ({ sourceId: e.sourceId, quote: e.text.slice(0, 160).trim() })),
      confidence: evidence.length >= 3 ? "medium" : "low",
      limitations: ["Jawaban dihasilkan oleh provider mock (development) dan bersifat ekstraktif."],
    };
  }
}

// ---------------------------------------------------------------------------
// OLLAMA — POST /api/chat with JSON format. Fails gracefully.
// ---------------------------------------------------------------------------
class OllamaLlmProvider implements LlmAnswerProvider {
  provider = "ollama";
  model = env.rag.llmModel;
  private baseUrl = env.rag.llmBaseUrl.replace(/\/$/, "");
  async generate(question: string, evidence: RetrievedEvidence[]): Promise<RawAnswer> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        format: "json",
        stream: false,
        messages: [
          { role: "system", content: APOF_SYSTEM_PROMPT },
          { role: "user", content: buildAnswerPrompt(question, evidence) },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Ollama chat HTTP ${res.status}`);
    const data = await res.json();
    return coerceRawAnswer(data?.message?.content ?? "");
  }
}

// ---------------------------------------------------------------------------
// CUSTOM_HTTP — OpenAI-compatible /chat/completions on a local server.
// ---------------------------------------------------------------------------
class CustomHttpLlmProvider implements LlmAnswerProvider {
  provider = "custom_http";
  model = env.rag.llmModel;
  async generate(question: string, evidence: RetrievedEvidence[]): Promise<RawAnswer> {
    if (!env.rag.llmHttpUrl) throw new Error("RAG_LLM_HTTP_URL not configured");
    const res = await fetch(env.rag.llmHttpUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: APOF_SYSTEM_PROMPT },
          { role: "user", content: buildAnswerPrompt(question, evidence) },
        ],
        temperature: 0,
      }),
    });
    if (!res.ok) throw new Error(`Custom LLM HTTP ${res.status}`);
    const data = await res.json();
    return coerceRawAnswer(data?.choices?.[0]?.message?.content ?? "");
  }
}

/** Parse model output into RawAnswer; tolerant of fenced/extra text. */
export function coerceRawAnswer(text: string): RawAnswer {
  let json: Record<string, unknown> = {};
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    json = start >= 0 && end > start ? JSON.parse(text.slice(start, end + 1)) : {};
  } catch {
    json = {};
  }
  const conf = json.confidence;
  return {
    answer: typeof json.answer === "string" ? json.answer : "Tidak ditemukan dalam dokumen yang tersedia.",
    simpleExplanation: typeof json.simpleExplanation === "string" ? json.simpleExplanation : "",
    citations: Array.isArray(json.citations)
      ? (json.citations as RawAnswer["citations"]).filter((c) => c && typeof c.sourceId === "string")
      : [],
    confidence: conf === "high" || conf === "medium" || conf === "low" ? conf : "low",
    limitations: Array.isArray(json.limitations) ? (json.limitations as string[]).filter((l) => typeof l === "string") : [],
  };
}

let cached: LlmAnswerProvider | null = null;
export function getLlmProvider(): LlmAnswerProvider {
  if (cached) return cached;
  switch (env.rag.llmProvider) {
    case "ollama":
      cached = new OllamaLlmProvider();
      break;
    case "custom_http":
      cached = new CustomHttpLlmProvider();
      break;
    default:
      cached = new MockLlmProvider();
  }
  return cached;
}

export function isMockLlm(): boolean {
  return env.rag.llmProvider === "mock";
}
