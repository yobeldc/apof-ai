import { prisma } from "./db";
import { fromJsonList, fromJsonRecord } from "./serialize";
import type { CaseSummary } from "./summarize";

export type ClientNote = {
  id: string;
  title: string | null;
  body: string;
  tags: string[];
  updatedAt: string;
};

export type ClientCase = {
  id: string;
  sourceUrl: string;
  sourceDomain: string;
  nomorPutusan: string | null;
  tingkatProses: string | null;
  klasifikasi: string | null;
  kataKunci: string[];
  tahun: number | null;
  tanggalRegister: string | null;
  tanggalPutusan: string | null;
  tanggalMusyawarah: string | null;
  lembagaPeradilan: string | null;
  jenisLembagaPeradilan: string | null;
  pengadilan: string | null;
  provinsi: string | null;
  hakim: string[];
  panitera: string | null;
  pihak: string[];
  pemohon: string | null;
  termohon: string | null;
  terdakwa: string | null;
  penggugat: string | null;
  tergugat: string | null;
  amarPutusan: string | null;
  ringkasanSingkat: string | null;
  fullText: string | null;
  aiSummary: string | null;
  aiSummaryJson: CaseSummary | null;
  pdfUrl: string | null;
  /** Route to a locally-stored (offline-imported) PDF, if any. */
  localPdfUrl: string | null;
  hasPdf: boolean;
  hasFullText: boolean;
  extractionStatus: string;
  confidence: Record<string, number>;
  isDemo: boolean;
  isSaved: boolean;
  createdAt: string;
};

export async function getCaseForClient(id: string): Promise<{ case: ClientCase; notes: ClientNote[] } | null> {
  const c = await prisma.caseDecision.findUnique({ where: { id }, include: { notes: { orderBy: { updatedAt: "desc" } } } });
  if (!c) return null;
  const saved = await prisma.savedCase.findFirst({ where: { caseId: id } });
  const confidence = fromJsonRecord<Record<string, number>>(c.confidenceJson);

  const out: ClientCase = {
    id: c.id,
    sourceUrl: c.sourceUrl,
    sourceDomain: c.sourceDomain,
    nomorPutusan: c.nomorPutusan,
    tingkatProses: c.tingkatProses,
    klasifikasi: c.klasifikasi,
    kataKunci: fromJsonList(c.kataKunci),
    tahun: c.tahun,
    tanggalRegister: c.tanggalRegister,
    tanggalPutusan: c.tanggalPutusan,
    tanggalMusyawarah: c.tanggalMusyawarah,
    lembagaPeradilan: c.lembagaPeradilan,
    jenisLembagaPeradilan: c.jenisLembagaPeradilan,
    pengadilan: c.pengadilan,
    provinsi: c.provinsi,
    hakim: fromJsonList(c.hakim),
    panitera: c.panitera,
    pihak: fromJsonList(c.pihak),
    pemohon: c.pemohon,
    termohon: c.termohon,
    terdakwa: c.terdakwa,
    penggugat: c.penggugat,
    tergugat: c.tergugat,
    amarPutusan: c.amarPutusan,
    ringkasanSingkat: c.ringkasanSingkat,
    fullText: c.fullText,
    aiSummary: c.aiSummary,
    aiSummaryJson: c.aiSummaryJson ? fromJsonRecord<CaseSummary>(c.aiSummaryJson) : null,
    pdfUrl: c.pdfUrl,
    localPdfUrl: c.localPdfPath ? `/api/cases/${c.id}/pdf` : null,
    hasPdf: c.hasPdf,
    hasFullText: c.hasFullText,
    extractionStatus: c.extractionStatus,
    confidence,
    isDemo: confidence._demo === 1 || c.sourceUrl.includes("/demo-"),
    isSaved: !!saved,
    createdAt: c.createdAt.toISOString(),
  };

  const notes: ClientNote[] = c.notes.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    tags: fromJsonList(n.tags),
    updatedAt: n.updatedAt.toISOString(),
  }));

  return { case: out, notes };
}

/** Lightweight "similar cases" via shared klasifikasi/keywords (local search). */
export async function getSimilarCases(c: ClientCase, limit = 5) {
  const rows = await prisma.caseDecision.findMany({
    where: {
      id: { not: c.id },
      OR: [
        c.klasifikasi ? { klasifikasi: c.klasifikasi } : {},
        c.tingkatProses ? { tingkatProses: c.tingkatProses } : {},
      ].filter((x) => Object.keys(x).length),
    },
    take: limit,
    orderBy: { tanggalPutusan: "desc" },
    select: { id: true, nomorPutusan: true, pengadilan: true, klasifikasi: true, tahun: true },
  });
  return rows;
}
