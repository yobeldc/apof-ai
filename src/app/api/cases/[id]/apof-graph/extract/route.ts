import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { extractApofGraph } from "@/lib/apof-graph/extract";
import { persistExtraction } from "@/lib/apof-graph/persist";

/**
 * POST /api/cases/[id]/apof-graph/extract
 * Triggers extraction for a single case.
 * Body: { useLlm?: boolean, force?: boolean }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { useLlm, force } = body;

    // Check if extraction already exists
    if (!force) {
      const existing = await prisma.apofGraphExtraction.findUnique({
        where: { caseDecisionId: id },
      });
      if (existing) {
        return NextResponse.json(
          { error: "Extraction already exists. Use force=true to re-extract." },
          { status: 409 }
        );
      }
    }

    // Set status to extracting
    await prisma.caseDecision.update({
      where: { id },
      data: { apofGraphStatus: "extracting" },
    });

    // Run extraction
    const result = await extractApofGraph({
      caseDecisionId: id,
      useLlm: useLlm ?? false,
    });

    if (result.error || !result.extraction) {
      await prisma.caseDecision.update({
        where: { id },
        data: { apofGraphStatus: "failed" },
      });
      return NextResponse.json(
        { error: result.error ?? "Extraction failed" },
        { status: 500 }
      );
    }

    // Persist
    const persistResult = await persistExtraction(
      id,
      result.extraction,
      result.method,
      "1.0.0"
    );

    return NextResponse.json({
      success: true,
      extractionId: persistResult.extractionId,
      method: result.method,
      normalized: persistResult.normalized,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Reset status on error
    try {
      const { id } = await params;
      await prisma.caseDecision.update({
        where: { id },
        data: { apofGraphStatus: "failed" },
      });
    } catch {
      // Ignore
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
