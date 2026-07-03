import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/apof-graph/judges
 * Returns judges with case counts.
 * Query params: search, limit, offset
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    const where: Record<string, unknown> = {};
    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    const [judges, total] = await Promise.all([
      prisma.judge.findMany({
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
      prisma.judge.count({ where }),
    ]);

    return NextResponse.json({
      judges: judges.map((j) => ({
        id: j.id,
        name: j.name,
        caseCount: j._count.decisions,
      })),
      total,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
