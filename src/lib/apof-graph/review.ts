/**
 * Human review queue logic for Apof Graph.
 *
 * Auto-flags cases for review based on extraction quality heuristics.
 */

import { prisma } from "../db";
import type { ApofGraphDecisionExtraction } from "./schema";

export interface ReviewQueueFilters {
  status?: string;
  priority?: string;
  reviewType?: string;
  caseDecisionId?: string;
}

/**
 * Get review queue items.
 */
export async function getReviewQueue(filters: ReviewQueueFilters) {
  const where: Record<string, unknown> = {};
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.reviewType) where.reviewType = filters.reviewType;
  if (filters.caseDecisionId) where.caseDecisionId = filters.caseDecisionId;

  return prisma.humanReview.findMany({
    where,
    include: {
      caseDecision: {
        select: { nomorPutusan: true, pengadilan: true },
      },
    },
    orderBy: [
      { priority: "asc" },
      { createdAt: "desc" },
    ],
  });
}

/**
 * Create a review entry.
 */
export async function createReview(
  caseDecisionId: string,
  reviewType: string,
  priority?: string
) {
  return prisma.humanReview.create({
    data: {
      caseDecisionId,
      reviewType,
      priority: priority ?? "normal",
    },
  });
}

/**
 * Update a review entry.
 */
export async function updateReview(
  reviewId: string,
  updates: { status?: string; findings?: string[]; corrections?: string[]; notes?: string; reviewer?: string }
) {
  const data: Record<string, unknown> = {};
  if (updates.status !== undefined) data.status = updates.status;
  if (updates.findings !== undefined) data.findingsJson = JSON.stringify(updates.findings);
  if (updates.corrections !== undefined) data.correctionsJson = JSON.stringify(updates.corrections);
  if (updates.notes !== undefined) data.notes = updates.notes;
  if (updates.reviewer !== undefined) data.reviewer = updates.reviewer;
  if (updates.status === "approved" || updates.status === "rejected") {
    data.completedAt = new Date();
  }

  return prisma.humanReview.update({
    where: { id: reviewId },
    data,
  });
}

/**
 * Auto-flag a case for review based on extraction quality.
 * Returns list of created review IDs.
 */
export async function autoFlagForReview(
  caseDecisionId: string,
  extraction: ApofGraphDecisionExtraction
): Promise<string[]> {
  const reviewIds: string[] = [];
  const confidence = extraction.extraction_confidence ?? {};

  // Low confidence ratio decidendi
  if ((confidence["ratio_decidendi"] ?? 0) < 0.5 && extraction.ratio_decidendi !== null) {
    const r = await createReview(caseDecisionId, "extraction_accuracy", "high");
    reviewIds.push(r.id);
  }

  // Low confidence legal issues
  for (const issue of extraction.legal_issues) {
    if (issue.confidence < 0.5) {
      const r = await createReview(caseDecisionId, "legal_issue", "normal");
      reviewIds.push(r.id);
      break; // One issue review per case
    }
  }

  // Low confidence sentence
  if (extraction.sentence && (extraction.sentence.confidence ?? 0) < 0.5) {
    const r = await createReview(caseDecisionId, "sentence", "high");
    reviewIds.push(r.id);
  }

  // No evidence spans for non-null fields
  const hasEvidence = (field: string) =>
    extraction.evidence_spans.some((s) => s.target_path === field);

  if (extraction.ratio_decidendi !== null && !hasEvidence("ratio_decidendi")) {
    const r = await createReview(caseDecisionId, "extraction_accuracy", "normal");
    reviewIds.push(r.id);
  }

  // Dissenting opinion detected
  if (extraction.dissenting_opinion !== null) {
    const r = await createReview(caseDecisionId, "extraction_accuracy", "low");
    reviewIds.push(r.id);
  }

  // Privacy-sensitive: check for party names in sensitive classifications
  if (extraction.klasifikasi?.toLowerCase().includes("pidana khusus")) {
    const r = await createReview(caseDecisionId, "privacy_check", "high");
    reviewIds.push(r.id);
  }

  return reviewIds;
}
