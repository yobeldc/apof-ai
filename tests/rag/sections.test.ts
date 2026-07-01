import { describe, it, expect } from "vitest";
import { detectSections, detectSectionMarkers } from "@/lib/legal/sections";
import { extractCitedArticles, cleanLegalText } from "@/lib/legal/normalize";

const SAMPLE = `P U T U S A N
Nomor 2451 K/Pid.Sus/2021
DEMI KEADILAN BERDASARKAN KETUHANAN YANG MAHA ESA
Mahkamah Agung memeriksa perkara pidana khusus pada tingkat kasasi.

Menimbang bahwa alasan-alasan kasasi tidak dapat dibenarkan karena judex facti tidak salah menerapkan hukum sebagaimana Pasal 378 KUHP dan Pasal 1365 KUHPerdata.

Mengingat Undang-Undang Nomor 48 Tahun 2009.

M E N G A D I L I
Menolak permohonan kasasi dari Pemohon Kasasi/Terdakwa; Membebankan biaya perkara kepada Terdakwa.`;

describe("legal section detection", () => {
  const sections = detectSections(cleanLegalText(SAMPLE));

  it("detects the kepala putusan / case identity header", () => {
    expect(sections.some((s) => s.kind === "case_identity")).toBe(true);
  });

  it("detects court reasoning (Menimbang)", () => {
    expect(sections.some((s) => s.kind === "court_reasoning")).toBe(true);
  });

  it("detects legal basis (Mengingat)", () => {
    expect(sections.some((s) => s.kind === "legal_basis")).toBe(true);
  });

  it("detects the final ruling (Mengadili)", () => {
    const ruling = sections.find((s) => s.kind === "final_ruling");
    expect(ruling).toBeTruthy();
    expect(ruling!.text).toMatch(/Menolak permohonan kasasi/i);
  });

  it("preserves original text within sections (no invention)", () => {
    for (const s of sections) expect(SAMPLE.toLowerCase()).toContain(s.text.slice(0, 20).toLowerCase());
  });

  it("returns a single unknown section when nothing matches", () => {
    const none = detectSections("teks biasa tanpa penanda hukum apa pun di sini");
    expect(none).toHaveLength(1);
    expect(none[0].kind).toBe("unknown");
  });

  it("markers are ordered by position", () => {
    const markers = detectSectionMarkers(SAMPLE);
    for (let i = 1; i < markers.length; i++) expect(markers[i].index).toBeGreaterThanOrEqual(markers[i - 1].index);
  });
});

describe("cited article extraction", () => {
  it("extracts KUHP and KUHPerdata articles", () => {
    const arts = extractCitedArticles(SAMPLE);
    expect(arts).toContain("Pasal 378 KUHP");
    expect(arts.some((a) => a.startsWith("Pasal 1365"))).toBe(true);
  });
  it("returns empty array when no articles present", () => {
    expect(extractCitedArticles("tidak ada pasal di sini")).toEqual([]);
  });
});
