import { describe, it, expect } from "vitest";
import { chunkDocument } from "@/lib/rag/chunk";
import type { NormalizedLegalDocument, LegalSection } from "@/lib/legal/types";

function section(kind: LegalSection["kind"], title: string, text: string, page = 1): LegalSection {
  return { kind, title, start: 0, end: text.length, text, pageStart: page, pageEnd: page, confidence: 1 };
}

function doc(sections: LegalSection[]): NormalizedLegalDocument {
  return {
    caseDecisionId: "case_123",
    sourceUrl: null,
    originalFilename: null,
    caseNumber: "2451 K/Pid.Sus/2021",
    courtLevel: "Kasasi",
    courtName: "Mahkamah Agung",
    decisionDate: "2021-09-28",
    importDate: new Date().toISOString(),
    judges: ["Dr. Suhadi, S.H., M.H."],
    parties: ["Jaksa Penuntut Umum", "AS bin SR"],
    classification: "Pidana Khusus",
    legalArticles: [],
    pageCount: 1,
    rawText: sections.map((s) => s.text).join("\n"),
    cleanedText: sections.map((s) => s.text).join("\n"),
    sections,
    extractionStatus: "complete",
    extractionConfidence: 1,
    warnings: [],
  };
}

describe("legal-aware chunking", () => {
  it("produces deterministic chunk IDs", () => {
    const d = doc([section("final_ruling", "Mengadili", "Menolak permohonan kasasi dari Pemohon Kasasi.")]);
    const a = chunkDocument(d);
    const b = chunkDocument(d);
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
    expect(a[0].id).toMatch(/^chk_[0-9a-f]{24}$/);
  });

  it("never emits empty chunks", () => {
    const d = doc([
      section("court_reasoning", "Menimbang", "   "),
      section("final_ruling", "Mengadili", "Menolak permohonan kasasi."),
    ]);
    const chunks = chunkDocument(d);
    expect(chunks.length).toBeGreaterThan(0);
    for (const c of chunks) expect(c.text.trim().length).toBeGreaterThan(0);
  });

  it("preserves section + page metadata", () => {
    const d = doc([section("final_ruling", "Mengadili", "Menolak permohonan kasasi.", 3)]);
    const [c] = chunkDocument(d);
    expect(c.sectionKind).toBe("final_ruling");
    expect(c.sectionTitle).toBe("Mengadili");
    expect(c.pageStart).toBe(3);
    expect(c.pageEnd).toBe(3);
  });

  it("keeps a short section as a single chunk", () => {
    const d = doc([section("final_ruling", "Mengadili", "Menolak permohonan kasasi.")]);
    expect(chunkDocument(d)).toHaveLength(1);
  });

  it("splits a long section into multiple overlapping chunks", () => {
    const long = "Menimbang bahwa " + "kalimat hukum yang panjang. ".repeat(600); // ~16k chars
    const d = doc([section("court_reasoning", "Menimbang", long)]);
    const chunks = chunkDocument(d, { targetChars: 4000, overlapChars: 600 });
    expect(chunks.length).toBeGreaterThan(1);
    // chunk indexes are sequential
    chunks.forEach((c, i) => expect(c.chunkIndex).toBe(i));
    // overlap: end of chunk[0] shares text with start of chunk[1]
    const tail = chunks[0].text.slice(-200);
    const head = chunks[1].text.slice(0, 600);
    const overlapWord = tail.trim().split(/\s+/).slice(-3).join(" ");
    expect(head).toContain(overlapWord.split(" ").pop()!);
  });

  it("captures parties mentioned in a chunk", () => {
    const d = doc([section("parties", "Para Pihak", "Terdakwa AS bin SR dihadapkan oleh Jaksa Penuntut Umum.")]);
    const [c] = chunkDocument(d);
    expect(c.partiesMentioned.length).toBeGreaterThan(0);
  });

  it("falls back to one unknown chunk when no sections exist", () => {
    const d = doc([]);
    d.cleanedText = "Sebuah dokumen tanpa penanda bagian hukum.";
    const chunks = chunkDocument(d);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].sectionKind).toBe("unknown");
  });
});
