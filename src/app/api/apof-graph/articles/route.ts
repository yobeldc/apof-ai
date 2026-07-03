import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/apof-graph/articles
 * Returns cited articles with case counts.
 * Query params: statute, search, limit, offset
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statute = searchParams.get("statute");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    const where: Record<string, unknown> = {};
    if (search) {
      where.articleNumber = { contains: search, mode: "insensitive" };
    }

    const statuteWhere: Record<string, unknown> = {};
    if (statute) {
      statuteWhere.name = { contains: statute, mode: "insensitive" };
    }

    const [articles, total] = await Promise.all([
      prisma.statuteArticle.findMany({
        where,
        skip: offset,
        take: limit,
        include: {
          statute: {
            where: statuteWhere,
          },
          _count: {
            select: { decisions: true },
          },
        },
        orderBy: { decisions: { _count: "desc" } },
      }),
      prisma.statuteArticle.count({ where }),
    ]);

    const filtered = articles.filter((a) => a.statute !== null);

    return NextResponse.json({
      articles: filtered.map((a) => ({
        id: a.id,
        statute: a.statute?.name ?? "",
        article: a.articleNumber,
        description: a.description,
        caseCount: a._count.decisions,
      })),
      total,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
