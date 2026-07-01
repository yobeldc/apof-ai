import { describe, it, expect } from "vitest";
import { quoteSupported, verifyCitations } from "@/lib/rag/verify";
import { ragAnswerSchema, NOT_FOUND_ANSWER } from "@/lib/rag/answer";
import { coerceRawAnswer } from "@/lib/rag/llm";
import { buildEvidencePack, buildAnswerPrompt } from "@/lib/rag/prompts";
import type { RetrievedEvidence } from "@/lib/rag/retrieve";

const evidence: RetrievedEvidence[] = [
  {
    sourceId: "chk_aaa", chunkId: "chk_aaa", caseDecisionId: "c1", score: 0.9, source: "hybrid",
    text: "Mengadili menolak permohonan kasasi dari Pemohon Kasasi/Terdakwa.",
    caseNumber: "2451 K/Pid.Sus/2021", title: null, sectionTitle: "Mengadili", sectionKind: "final_ruling",
    pageStart: 1, pageEnd: 1, paragraphStart: null, paragraphEnd: null, metadata: {},
  },
  {
    sourceId: "chk_bbb", chunkId: "chk_bbb", caseDecisionId: "c1", score: 0.6, source: "vector",
    text: "Menimbang bahwa alasan kasasi tidak dapat dibenarkan.",
    caseNumber: "2451 K/Pid.Sus/2021", title: null, sectionTitle: "Menimbang", sectionKind: "court_reasoning",
    pageStart: 1, pageEnd: 1, paragraphStart: null, paragraphEnd: null, metadata: {},
  },
];

describe("quote support", () => {
  it("accepts a quote that appears in the chunk", () => {
    expect(quoteSupported("menolak permohonan kasasi", evidence[0].text)).toBe(true);
  });
  it("rejects a fabricated quote", () => {
    expect(quoteSupported("terdakwa dijatuhi hukuman mati seumur hidup di mars", evidence[0].text)).toBe(false);
  });
});

describe("citation verification", () => {
  it("keeps supported citations", () => {
    const out = verifyCitations([{ sourceId: "chk_aaa", quote: "menolak permohonan kasasi" }], evidence, "high");
    expect(out.citations).toHaveLength(1);
    expect(out.citations[0].sectionKind).toBe("final_ruling");
    expect(out.citations[0].pageStart).toBe(1);
  });

  it("drops citations referencing non-existent evidence", () => {
    const out = verifyCitations([{ sourceId: "chk_ZZZ", quote: "apa pun" }], evidence, "high");
    expect(out.citations).toHaveLength(0);
    expect(out.confidence).toBe("low");
    expect(out.unsupportedCount).toBe(1);
  });

  it("downgrades confidence when a quote is unsupported", () => {
    const out = verifyCitations([{ sourceId: "chk_aaa", quote: "kalimat yang tidak ada sama sekali di dokumen" }], evidence, "high");
    expect(out.confidence).not.toBe("high");
    expect(out.unsupportedCount).toBe(1);
  });
});

describe("answer schema + fallback", () => {
  it("NOT_FOUND_ANSWER matches the documented abstain shape", () => {
    const full = { ...NOT_FOUND_ANSWER, evidence: [] };
    expect(() => ragAnswerSchema.parse(full)).not.toThrow();
    expect(full.notFound).toBe(true);
    expect(full.answer).toBe("Tidak ditemukan dalam dokumen yang tersedia.");
  });

  it("coerceRawAnswer tolerates fenced/garbage JSON", () => {
    const r = coerceRawAnswer('noise ```json {"answer":"x","simpleExplanation":"y","citations":[],"confidence":"medium","limitations":[]} ``` trailing');
    expect(r.answer).toBe("x");
    expect(r.confidence).toBe("medium");
  });

  it("coerceRawAnswer abstains on unparseable output", () => {
    const r = coerceRawAnswer("not json at all");
    expect(r.confidence).toBe("low");
    expect(r.citations).toEqual([]);
  });
});

describe("prompt formatting", () => {
  it("evidence pack includes source IDs", () => {
    const pack = buildEvidencePack(evidence);
    expect(pack).toContain("[chk_aaa]");
    expect(pack).toContain("[chk_bbb]");
  });
  it("answer prompt embeds the question and JSON schema", () => {
    const p = buildAnswerPrompt("Apa amar putusannya?", evidence);
    expect(p).toContain("Apa amar putusannya?");
    expect(p).toContain("simpleExplanation");
  });
  it("empty evidence pack is labeled", () => {
    expect(buildEvidencePack([])).toBe("(no evidence)");
  });
});
