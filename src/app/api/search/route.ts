import { NextResponse } from "next/server";
import { search, type SearchParams, type SortKey } from "@/lib/search";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function parseList(v: string | null): string[] | undefined {
  if (!v) return undefined;
  const arr = v.split(",").map((s) => s.trim()).filter(Boolean);
  return arr.length ? arr : undefined;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sp = url.searchParams;

  const params: SearchParams = {
    q: sp.get("q") ?? undefined,
    year: parseList(sp.get("year"))?.map(Number).filter((n) => !Number.isNaN(n)),
    court: parseList(sp.get("court")),
    klasifikasi: parseList(sp.get("klasifikasi")),
    tingkatProses: parseList(sp.get("tingkat")),
    amar: sp.get("amar") ?? undefined,
    hasPdf: sp.get("hasPdf") === "true" ? true : undefined,
    hasFullText: sp.get("hasFullText") === "true" ? true : undefined,
    savedOnly: sp.get("saved") === "true" ? true : undefined,
    sort: (sp.get("sort") as SortKey) ?? "relevance",
    page: sp.get("page") ? Number(sp.get("page")) : 1,
    pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : 20,
  };

  const result = await search(params);

  // Record non-empty queries for the dashboard "recent searches" widget.
  if (params.q && params.q.trim() && (params.page ?? 1) === 1) {
    prisma.searchHistory
      .create({ data: { query: params.q.trim(), resultCount: result.total } })
      .catch(() => {});
  }

  return NextResponse.json(result);
}
