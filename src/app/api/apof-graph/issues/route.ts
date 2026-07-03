import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/apof-graph/issues
 * Returns legal issues with case counts.
 * Query params: category, search, limit, offset
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    if (search) {
      where.label = { contains: search, mode: "insensitive" };
    }

    const [issues, total] = await Promise.all([
      prisma.legalIssue.findMany({
        where,
        skip: offset,
        take: limit,
        include: {
          _count: {
            select: { decisions: true },
          },
        },
        orderBy: { decisions: { _count: "desc" } },
      }),
      prisma.legalIssue.count({ where }),
    ]);

    return NextResponse.json({
      issues: issues.map((i) => ({
        id: i.id,
        label: i.label,
        category: i.category,
        description: i.description,
        caseCount: i._count.decisions,
      })),
      total,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
