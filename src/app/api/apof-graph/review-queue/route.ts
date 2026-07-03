import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/apof-graph/review-queue
 * Returns review queue items.
 * Query params: status, priority, reviewType, limit, offset
 *
 * POST /api/apof-graph/review-queue
 * Creates a new review queue entry.
 * Body: { caseDecisionId: string, reviewType: string, priority?: string }
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const reviewType = searchParams.get("reviewType");
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (reviewType) where.reviewType = reviewType;

    const [items, total] = await Promise.all([
      prisma.humanReview.findMany({
        where,
        skip: offset,
        take: limit,
        include: {
          caseDecision: {
            select: {
              nomorPutusan: true,
              pengadilan: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.humanReview.count({ where }),
    ]);

    return NextResponse.json({
      items: items.map((r) => ({
        id: r.id,
        caseDecisionId: r.caseDecisionId,
        nomorPutusan: r.caseDecision?.nomorPutusan ?? null,
        status: r.status,
        priority: r.priority,
        reviewType: r.reviewType,
        createdAt: r.createdAt,
        notes: r.notes,
      })),
      total,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { caseDecisionId, reviewType, priority } = body;

    if (!caseDecisionId || !reviewType) {
      return NextResponse.json(
        { error: "caseDecisionId and reviewType are required" },
        { status: 400 }
      );
    }

    const review = await prisma.humanReview.create({
      data: {
        caseDecisionId,
        reviewType,
        priority: priority ?? "normal",
      },
    });

    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
