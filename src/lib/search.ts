import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { env } from "./env";
import { fromJsonList } from "./serialize";

/**
 * Search abstraction. Two interchangeable providers:
 *  - "local": SQLite-backed (default, zero setup). Good for a personal MVP.
 *  - "meili": Meilisearch (typo-tolerant, faster at scale).
 * The same SearchParams/SearchResponse shape is used by both, so the UI and API
 * never care which is active. To add Meilisearch later, just flip SEARCH_PROVIDER.
 */

export type SortKey = "relevance" | "newest" | "oldest" | "recent";

export type SearchParams = {
  q?: string;
  year?: number[];
  court?: string[];
  tingkatProses?: string[];
  klasifikasi?: string[];
  amar?: string;
  hasPdf?: boolean;
  hasFullText?: boolean;
  savedOnly?: boolean;
  sort?: SortKey;
  page?: number;
  pageSize?: number;
};

export type SearchHit = {
  id: string;
  nomorPutusan: string | null;
  pengadilan: string | null;
  lembagaPeradilan: string | null;
  tingkatProses: string | null;
  klasifikasi: string | null;
  tahun: number | null;
  tanggalPutusan: string | null;
  amarPutusan: string | null;
  ringkasanSingkat: string | null;
  pihak: string[];
  hasPdf: boolean;
  hasFullText: boolean;
  extractionStatus: string;
  sourceUrl: string;
  createdAt: string;
  isSaved: boolean;
};

export type Facets = {
  years: { value: number; count: number }[];
  courts: { value: string; count: number }[];
  klasifikasi: { value: string; count: number }[];
  tingkatProses: { value: string; count: number }[];
};

export type SearchResponse = {
  hits: SearchHit[];
  total: number;
  page: number;
  pageSize: number;
  tookMs: number;
  facets: Facets;
  provider: "local" | "meili";
};

const SEARCHABLE_FIELDS = [
  "nomorPutusan",
  "pihak",
  "amarPutusan",
  "fullText",
  "klasifikasi",
  "kataKunci",
  "pengadilan",
  "hakim",
  "ringkasanSingkat",
] as const;

function toHit(c: any, savedIds: Set<string>): SearchHit {
  return {
    id: c.id,
    nomorPutusan: c.nomorPutusan,
    pengadilan: c.pengadilan,
    lembagaPeradilan: c.lembagaPeradilan,
    tingkatProses: c.tingkatProses,
    klasifikasi: c.klasifikasi,
    tahun: c.tahun,
    tanggalPutusan: c.tanggalPutusan,
    amarPutusan: c.amarPutusan,
    ringkasanSingkat: c.ringkasanSingkat,
    pihak: fromJsonList(c.pihak),
    hasPdf: c.hasPdf,
    hasFullText: c.hasFullText,
    extractionStatus: c.extractionStatus,
    sourceUrl: c.sourceUrl,
    createdAt: (c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt) ?? "",
    isSaved: savedIds.has(c.id),
  };
}

// ---------------------------------------------------------------------------
// Local (SQLite) provider
// ---------------------------------------------------------------------------
async function localSearch(params: SearchParams): Promise<SearchResponse> {
  const start = Date.now();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, params.pageSize ?? 20);

  const AND: Prisma.CaseDecisionWhereInput[] = [];

  if (params.q && params.q.trim()) {
    const terms = params.q.trim().split(/\s+/).slice(0, 8);
    for (const term of terms) {
      AND.push({
        OR: SEARCHABLE_FIELDS.map((f) => ({
          [f]: { contains: term },
        })) as Prisma.CaseDecisionWhereInput[],
      });
    }
  }
  if (params.year?.length) AND.push({ tahun: { in: params.year } });
  if (params.court?.length) AND.push({ OR: params.court.map((c) => ({ pengadilan: c })) });
  if (params.klasifikasi?.length) AND.push({ OR: params.klasifikasi.map((c) => ({ klasifikasi: c })) });
  if (params.tingkatProses?.length) AND.push({ OR: params.tingkatProses.map((c) => ({ tingkatProses: c })) });
  if (params.amar && params.amar.trim()) AND.push({ amarPutusan: { contains: params.amar.trim() } });
  if (params.hasPdf) AND.push({ hasPdf: true });
  if (params.hasFullText) AND.push({ hasFullText: true });

  let savedIds = new Set<string>();
  if (params.savedOnly) {
    const saved = await prisma.savedCase.findMany({ select: { caseId: true } });
    savedIds = new Set(saved.map((s) => s.caseId));
    AND.push({ id: { in: Array.from(savedIds) } });
  } else {
    const saved = await prisma.savedCase.findMany({ select: { caseId: true } });
    savedIds = new Set(saved.map((s) => s.caseId));
  }

  const where: Prisma.CaseDecisionWhereInput = AND.length ? { AND } : {};

  const orderBy: Prisma.CaseDecisionOrderByWithRelationInput =
    params.sort === "oldest"
      ? { tanggalPutusan: "asc" }
      : params.sort === "recent"
        ? { createdAt: "desc" }
        : params.sort === "newest"
          ? { tanggalPutusan: "desc" }
          : { tanggalPutusan: "desc" }; // relevance ~ newest for local provider

  const [total, rows, allForFacets] = await Promise.all([
    prisma.caseDecision.count({ where }),
    prisma.caseDecision.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.caseDecision.findMany({
      where,
      select: { tahun: true, pengadilan: true, klasifikasi: true, tingkatProses: true },
      take: 5000,
    }),
  ]);

  return {
    hits: rows.map((r) => toHit(r, savedIds)),
    total,
    page,
    pageSize,
    tookMs: Date.now() - start,
    facets: buildFacets(allForFacets),
    provider: "local",
  };
}

function buildFacets(
  rows: { tahun: number | null; pengadilan: string | null; klasifikasi: string | null; tingkatProses: string | null }[],
): Facets {
  const count = <T,>(get: (r: (typeof rows)[number]) => T | null) => {
    const m = new Map<T, number>();
    for (const r of rows) {
      const v = get(r);
      if (v === null || v === undefined || v === "") continue;
      m.set(v, (m.get(v) ?? 0) + 1);
    }
    return Array.from(m.entries()).map(([value, c]) => ({ value, count: c }));
  };
  return {
    years: count((r) => r.tahun).sort((a, b) => Number(b.value) - Number(a.value)) as Facets["years"],
    courts: count((r) => r.pengadilan).sort((a, b) => b.count - a.count).slice(0, 30) as Facets["courts"],
    klasifikasi: count((r) => r.klasifikasi).sort((a, b) => b.count - a.count) as Facets["klasifikasi"],
    tingkatProses: count((r) => r.tingkatProses).sort((a, b) => b.count - a.count) as Facets["tingkatProses"],
  };
}

// ---------------------------------------------------------------------------
// Meilisearch provider (optional)
// ---------------------------------------------------------------------------
async function meiliSearch(params: SearchParams): Promise<SearchResponse> {
  const { MeiliSearch } = await import("meilisearch");
  const client = new MeiliSearch({ host: env.meili.host, apiKey: env.meili.apiKey || undefined });
  const index = client.index(env.meili.index);

  const filters: string[] = [];
  if (params.year?.length) filters.push(`tahun IN [${params.year.join(", ")}]`);
  if (params.klasifikasi?.length) filters.push(`klasifikasi IN [${params.klasifikasi.map((k) => `"${k}"`).join(", ")}]`);
  if (params.tingkatProses?.length) filters.push(`tingkat_proses IN [${params.tingkatProses.map((k) => `"${k}"`).join(", ")}]`);
  if (params.court?.length) filters.push(`pengadilan IN [${params.court.map((k) => `"${k}"`).join(", ")}]`);
  if (params.hasPdf) filters.push(`has_pdf = true`);

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, params.pageSize ?? 20);
  const sort =
    params.sort === "newest" ? ["tanggal_putusan:desc"]
    : params.sort === "oldest" ? ["tanggal_putusan:asc"]
    : params.sort === "recent" ? ["created_at:desc"]
    : undefined;

  const res = await index.search(params.q ?? "", {
    filter: filters.length ? filters.join(" AND ") : undefined,
    sort,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const saved = await prisma.savedCase.findMany({ select: { caseId: true } });
  const savedIds = new Set(saved.map((s) => s.caseId));

  return {
    hits: (res.hits as any[]).map((h) => toHit({ ...h, pihak: JSON.stringify(h.pihak ?? []) }, savedIds)),
    total: res.estimatedTotalHits ?? res.hits.length,
    page,
    pageSize,
    tookMs: res.processingTimeMs ?? 0,
    facets: { years: [], courts: [], klasifikasi: [], tingkatProses: [] },
    provider: "meili",
  };
}

export async function search(params: SearchParams): Promise<SearchResponse> {
  if (env.searchProvider === "meili") {
    try {
      return await meiliSearch(params);
    } catch (err) {
      // Fail soft to local search so the UI never breaks if Meili is down.
      console.warn("[search] Meilisearch failed, falling back to local:", err);
    }
  }
  return localSearch(params);
}

/** Index a single case into the active search backend (no-op for local). */
export async function indexCaseDecision(caseId: string): Promise<void> {
  const c = await prisma.caseDecision.findUnique({ where: { id: caseId } });
  if (!c) return;
  await prisma.caseDecision.update({ where: { id: caseId }, data: { indexedAt: new Date() } });

  if (env.searchProvider === "meili") {
    try {
      const { MeiliSearch } = await import("meilisearch");
      const client = new MeiliSearch({ host: env.meili.host, apiKey: env.meili.apiKey || undefined });
      const index = client.index(env.meili.index);
      await index.addDocuments([
        {
          id: c.id,
          nomor_putusan: c.nomorPutusan,
          pihak: fromJsonList(c.pihak),
          amar_putusan: c.amarPutusan,
          full_text: c.fullText,
          klasifikasi: c.klasifikasi,
          kata_kunci: fromJsonList(c.kataKunci),
          pengadilan: c.pengadilan,
          hakim: fromJsonList(c.hakim),
          tahun: c.tahun,
          tingkat_proses: c.tingkatProses,
          has_pdf: c.hasPdf,
          extraction_status: c.extractionStatus,
          tanggal_putusan: c.tanggalPutusan,
          created_at: c.createdAt.getTime(),
        },
      ]);
    } catch (err) {
      console.warn("[index] Meilisearch index failed:", err);
    }
  }
}
