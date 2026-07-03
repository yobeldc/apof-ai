import { NextResponse } from "next/server";
import { generateResearchMemo } from "@/lib/apof-graph/memo";

/**
 * POST /api/apof-graph/memo
 * Generates a research memo from selected cases.
 * Body: { caseIds: string[], includeSimilarCases?, includeTrends?, focusIssues? }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { caseIds, includeSimilarCases, includeTrends, focusIssues } = body;

    if (!Array.isArray(caseIds) || caseIds.length === 0) {
      return NextResponse.json(
        { error: "caseIds must be a non-empty array" },
        { status: 400 }
      );
    }

    const memo = await generateResearchMemo({
      caseDecisionIds: caseIds,
      includeSimilarCases: includeSimilarCases ?? false,
      includeTrends: includeTrends ?? false,
      focusIssues: focusIssues ?? [],
    });

    return NextResponse.json({ memo });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
