import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/apof-graph/review/[id]
 * Returns a single review with case details.
 *
 * PATCH /api/apof-graph/review/[id]
 * Updates a review entry.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const review = await prisma.humanReview.findUnique({
      where: { id },
      include: {
        caseDecision: {
          select: {
            nomorPutusan: true,
            pengadilan: true,
            sourceUrl: true,
          },
        },
      },
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    return NextResponse.json({
      review: {
        id: review.id,
        caseDecisionId: review.caseDecisionId,
        nomorPutusan: review.caseDecision?.nomorPutusan ?? null,
        status: review.status,
        priority: review.priority,
        reviewType: review.reviewType,
        findingsJson: review.findingsJson,
        correctionsJson: review.correctionsJson,
        notes: review.notes,
        reviewer: review.reviewer,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
        completedAt: review.completedAt,
      },
      case: {
        nomorPutusan: review.caseDecision?.nomorPutusan ?? null,
        pengadilan: review.caseDecision?.pengadilan ?? null,
        sourceUrl: review.caseDecision?.sourceUrl ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, findings, corrections, notes, reviewer } = body;

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (findings !== undefined) updateData.findingsJson = JSON.stringify(findings);
    if (corrections !== undefined) updateData.correctionsJson = JSON.stringify(corrections);
    if (notes !== undefined) updateData.notes = notes;
    if (reviewer !== undefined) updateData.reviewer = reviewer;
    if (status === "approved" || status === "rejected") {
      updateData.completedAt = new Date();
    }

    const review = await prisma.humanReview.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ review });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
