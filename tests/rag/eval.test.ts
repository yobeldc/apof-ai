import { describe, it, expect } from "vitest";
import {
  recallAtK, reciprocalRank, citationSupportRate, quoteSupportRate,
  notFoundCorrect, answerTermMatch, aggregate, type EvalScore,
} from "@/lib/rag/eval";

const TEXTS = [
  "Mengadili menolak permohonan kasasi dari Pemohon Kasasi/Terdakwa.",
  "Menimbang bahwa alasan kasasi tidak dapat dibenarkan.",
];

describe("recall@k", () => {
  it("is 1 when all expected snippets are present in top-k", () => {
    expect(recallAtK(TEXTS, ["menolak permohonan kasasi"], 6)).toBe(1);
  });
  it("is 0 when expected snippet is absent", () => {
    expect(recallAtK(TEXTS, ["hukuman mati"], 6)).toBe(0);
  });
  it("respects k (snippet only in a later chunk)", () => {
    expect(recallAtK(TEXTS, ["alasan kasasi"], 1)).toBe(0);
    expect(recallAtK(TEXTS, ["alasan kasasi"], 2)).toBe(1);
  });
});

describe("reciprocal rank", () => {
  it("is 1 when the first text matches", () => {
    expect(reciprocalRank(TEXTS, ["menolak"])).toBe(1);
  });
  it("is 1/2 when only the second text matches", () => {
    expect(reciprocalRank(TEXTS, ["alasan kasasi tidak dapat"])).toBeCloseTo(0.5);
  });
  it("is 0 when nothing matches", () => {
    expect(reciprocalRank(TEXTS, ["mars"])).toBe(0);
  });
});

describe("citation + quote support", () => {
  it("citation support counts ids present in evidence", () => {
    const rate = citationSupportRate([{ sourceId: "a" }, { sourceId: "x" }], new Set(["a", "b"]));
    expect(rate).toBe(0.5);
  });
  it("quote support uses approximate containment", () => {
    const textById = new Map([["a", TEXTS[0]]]);
    const ok = quoteSupportRate([{ sourceId: "a", quote: "menolak permohonan kasasi" }], textById);
    const bad = quoteSupportRate([{ sourceId: "a", quote: "kalimat yang sama sekali tidak ada" }], textById);
    expect(ok).toBe(1);
    expect(bad).toBe(0);
  });
});

describe("not-found correctness + answer match", () => {
  it("expects an answer by default", () => {
    expect(notFoundCorrect(undefined, false)).toBe(true);
    expect(notFoundCorrect(undefined, true)).toBe(false);
  });
  it("honors expectNotFound", () => {
    expect(notFoundCorrect(true, true)).toBe(true);
    expect(notFoundCorrect(true, false)).toBe(false);
  });
  it("answer term match fraction", () => {
    expect(answerTermMatch("Menolak permohonan kasasi", ["menolak", "kasasi"])).toBe(1);
    expect(answerTermMatch("Menolak permohonan kasasi", ["menolak", "banding"])).toBe(0.5);
  });
});

describe("aggregate", () => {
  it("averages per-item scores", () => {
    const scores: EvalScore[] = [
      { id: "1", recallAtK: 1, mrr: 1, citationSupport: 1, quoteSupport: 1, notFoundCorrect: true, answerMatch: 1 },
      { id: "2", recallAtK: 0, mrr: 0, citationSupport: 1, quoteSupport: 0, notFoundCorrect: false, answerMatch: 0 },
    ];
    const agg = aggregate(scores);
    expect(agg.count).toBe(2);
    expect(agg.recallAtK).toBe(0.5);
    expect(agg.notFoundAccuracy).toBe(0.5);
  });
});
