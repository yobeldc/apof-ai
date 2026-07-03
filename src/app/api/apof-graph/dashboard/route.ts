import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/apof-graph/dashboard
 * Returns corpus-level analytics for the Apof Graph dashboard.
 */
export async function GET() {
  try {
    const [
      totalCases,
      extractedCases,
      totalJudges,
      totalLegalIssues,
      totalStatutes,
      totalArticles,
      totalSentences,
      totalCitations,
      pendingReviews,
    ] = await Promise.all([
      prisma.caseDecision.count(),
      prisma.caseDecision.count({ where: { apofGraphStatus: "complete" } }),
      prisma.judge.count(),
      prisma.legalIssue.count(),
      prisma.statute.count(),
      prisma.statuteArticle.count(),
      prisma.decisionSentence.count(),
      prisma.decisionCitation.count(),
      prisma.humanReview.count({ where: { status: "pending" } }),
    ]);

    // Issue distribution
    const issueRows = await prisma.$queryRaw<
      Array<{ label: string; count: number }>
    >`
      SELECT li.label, COUNT(dli.id) as count
      FROM legal_issues li
      JOIN decision_legal_issues dli ON li.id = dli.legal_issue_id
      GROUP BY li.id, li.label
      ORDER BY count DESC
      LIMIT 20
    `;

    // Outcome distribution
    const outcomeRows = await prisma.$queryRaw<
      Array<{ outcome: string; count: number }>
    >`
      SELECT 
        CASE 
          WHEN json_extract(full_json, '$.outcome') IS NOT NULL 
          THEN json_extract(full_json, '$.outcome')
          ELSE 'unknown'
        END as outcome,
        COUNT(*) as count
      FROM apof_graph_extractions
      GROUP BY outcome
      ORDER BY count DESC
    `;

    // Extraction status distribution
    const statusRows = await prisma.$queryRaw<
      Array<{ status: string; count: number }>
    >`
      SELECT apof_graph_status as status, COUNT(*) as count
      FROM case_decisions
      GROUP BY apof_graph_status
      ORDER BY count DESC
    `;

    return NextResponse.json({
      totalCases,
      extractedCases,
      totalJudges,
      totalLegalIssues,
      totalStatutes,
      totalArticles,
      totalSentences,
      totalCitations,
      pendingReviews,
      issueDistribution: issueRows,
      outcomeDistribution: outcomeRows,
      extractionStatusDistribution: statusRows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
