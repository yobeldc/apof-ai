import { prisma } from "../db";
import { normalizeDocument } from "./normalize";
import { sectionTextOfKind } from "./sections";
import { deterministicSummary } from "../summarize";
import { fromJsonList } from "../serialize";
import type { NormalizedLegalDocument } from "./types";

/**
 * Structured, citation-aware case breakdown. Deterministic-first: every field is
 * filled ONLY from detected sections / stored metadata. Missing fields are
 * null/empty with an explicit limitation note — nothing is invented.
 */

export type CaseBreakdown = {
  caseIdentity: string | null;
  proceduralHistory: string | null;
  parties: string[];
  facts: string | null;
  legalIssues: string[];
  legalBasis: string[];
  claimantArguments: string | null;
  respondentArguments: string | null;
  courtReasoning: string | null;
  finalRuling: string | null;
  ratioDecidendi: string | null;
  obiterDicta: string | null;
  legalConsequences: string | null;
  timeline: Array<{ date?: string; event: string }>;
  glossary: Array<{ term: string; simpleMeaning: string }>;
  beginnerExplanation: string | null;
  examQuestions: string[];
  limitations: string[];
  method: "deterministic" | "llm";
};

/** Small, conservative glossary of common Indonesian legal terms. */
const GLOSSARY: Record<string, string> = {
  kasasi: "Upaya hukum ke Mahkamah Agung untuk memeriksa penerapan hukum oleh pengadilan di bawahnya.",
  "peninjauan kembali": "Upaya hukum luar biasa untuk meninjau putusan yang sudah berkekuatan hukum tetap.",
  banding: "Upaya hukum ke pengadilan tinggi untuk memeriksa ulang putusan tingkat pertama.",
  eksepsi: "Bantahan/keberatan formal sebelum masuk ke pokok perkara.",
  wanprestasi: "Tidak memenuhi kewajiban yang diperjanjikan dalam suatu perjanjian.",
  "perbuatan melawan hukum": "Perbuatan yang melanggar hukum dan merugikan orang lain (Pasal 1365 KUHPerdata).",
  amar: "Bagian putusan yang berisi keputusan akhir hakim (diktum).",
  "pertimbangan hukum": "Alasan-alasan hukum yang menjadi dasar putusan hakim.",
  "ratio decidendi": "Inti alasan hukum yang menjadi dasar lahirnya putusan.",
};

function clip(text: string | null, max = 1200): string | null {
  if (!text) return null;
  const t = text.trim();
  return t.length > max ? t.slice(0, max).trimEnd() + "…" : t;
}

function buildGlossary(doc: NormalizedLegalDocument): CaseBreakdown["glossary"] {
  const lower = doc.cleanedText.toLowerCase();
  return Object.entries(GLOSSARY)
    .filter(([term]) => lower.includes(term))
    .map(([term, simpleMeaning]) => ({ term, simpleMeaning }));
}

function buildExamQuestions(doc: NormalizedLegalDocument): string[] {
  const qs: string[] = [];
  if (sectionTextOfKind(doc.sections, "final_ruling")) qs.push("Apa amar putusan dalam perkara ini dan apa artinya?");
  if (sectionTextOfKind(doc.sections, "court_reasoning")) qs.push("Apa pertimbangan hukum utama majelis hakim?");
  if (doc.legalArticles.length) qs.push("Pasal apa saja yang menjadi dasar hukum putusan ini?");
  if (doc.parties.length) qs.push("Siapa para pihak dan apa posisi hukum masing-masing?");
  qs.push("Apa pelajaran hukum (ratio decidendi) yang bisa diambil dari perkara ini?");
  return qs.slice(0, 6);
}

const CASE_SELECT = {
  id: true, sourceUrl: true, nomorPutusan: true, tingkatProses: true, pengadilan: true,
  lembagaPeradilan: true, tanggalRegister: true, tanggalMusyawarah: true, tanggalPutusan: true,
  klasifikasi: true, kataKunci: true, hakim: true, pihak: true, fullText: true, createdAt: true,
  extractionStatus: true,
} as const;

export async function computeDeterministicBreakdown(caseId: string): Promise<CaseBreakdown> {
  const caseRow = await prisma.caseDecision.findUnique({ where: { id: caseId }, select: CASE_SELECT });
  if (!caseRow) throw new Error(`Case ${caseId} not found`);

  const pages = await prisma.documentPage.findMany({
    where: { caseDecisionId: caseId },
    orderBy: { pageNumber: "asc" },
    select: { pageNumber: true, text: true, confidence: true },
  });
  const doc = normalizeDocument({ ...caseRow, klasifikasi: caseRow.klasifikasi }, pages);

  const limitations: string[] = [...doc.warnings];
  const note = (field: string) => limitations.push(`${field} tidak terdeteksi secara deterministik dari dokumen.`);

  const caseIdentity =
    sectionTextOfKind(doc.sections, "case_identity") ??
    (doc.caseNumber ? `${doc.caseNumber} — ${doc.courtName ?? "pengadilan terkait"}` : null);
  const facts = sectionTextOfKind(doc.sections, "facts");
  const courtReasoning = sectionTextOfKind(doc.sections, "court_reasoning");
  const finalRuling = sectionTextOfKind(doc.sections, "final_ruling");
  const proceduralHistory = sectionTextOfKind(doc.sections, "procedural_history");
  const legalIssuesText = sectionTextOfKind(doc.sections, "legal_issues");

  if (!facts) note("Fakta (facts)");
  if (!courtReasoning) note("Pertimbangan hukum (court_reasoning)");
  if (!finalRuling) note("Amar (final_ruling)");
  // These are not deterministically separable from typical putusan structure.
  note("Argumen pemohon/penggugat & termohon/tergugat (dipisahkan)");
  note("Ratio decidendi & obiter dicta");
  note("Akibat hukum (legal_consequences)");

  const timeline = [
    { date: caseRow.tanggalRegister ?? undefined, event: "Register perkara" },
    { date: caseRow.tanggalMusyawarah ?? undefined, event: "Musyawarah majelis" },
    { date: caseRow.tanggalPutusan ?? undefined, event: "Putusan dibacakan" },
  ].filter((t) => t.date);

  const summary = deterministicSummary({
    nomorPutusan: caseRow.nomorPutusan,
    klasifikasi: caseRow.klasifikasi,
    tingkatProses: caseRow.tingkatProses,
    pengadilan: caseRow.pengadilan,
    lembagaPeradilan: caseRow.lembagaPeradilan,
    amarPutusan: finalRuling ?? null,
    fullText: caseRow.fullText,
    kataKunci: caseRow.kataKunci,
    tanggalRegister: caseRow.tanggalRegister,
    tanggalMusyawarah: caseRow.tanggalMusyawarah,
    tanggalPutusan: caseRow.tanggalPutusan,
  });

  return {
    caseIdentity: clip(caseIdentity),
    proceduralHistory: clip(proceduralHistory),
    parties: doc.parties,
    facts: clip(facts),
    legalIssues: legalIssuesText ? [clip(legalIssuesText, 400)!] : fromJsonList(caseRow.kataKunci),
    legalBasis: doc.legalArticles,
    claimantArguments: null,
    respondentArguments: null,
    courtReasoning: clip(courtReasoning),
    finalRuling: clip(finalRuling),
    ratioDecidendi: null,
    obiterDicta: null,
    legalConsequences: null,
    timeline,
    glossary: buildGlossary(doc),
    beginnerExplanation: summary.ringkasan,
    examQuestions: buildExamQuestions(doc),
    limitations: Array.from(new Set(limitations)),
    method: "deterministic",
  };
}

/** Compute + persist (cache) a breakdown. Returns the stored breakdown. */
export async function generateBreakdown(caseId: string, opts: { force?: boolean } = {}): Promise<CaseBreakdown> {
  if (!opts.force) {
    const existing = await prisma.caseAnalysis.findUnique({ where: { caseDecisionId: caseId } });
    if (existing) return JSON.parse(existing.breakdownJson) as CaseBreakdown;
  }
  const breakdown = await computeDeterministicBreakdown(caseId);
  await prisma.caseAnalysis.upsert({
    where: { caseDecisionId: caseId },
    update: { method: breakdown.method, breakdownJson: JSON.stringify(breakdown) },
    create: { caseDecisionId: caseId, method: breakdown.method, breakdownJson: JSON.stringify(breakdown) },
  });
  return breakdown;
}
