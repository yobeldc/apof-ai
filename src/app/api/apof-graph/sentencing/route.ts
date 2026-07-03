import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/apof-graph/sentencing
 * Returns sentencing analytics.
 */
export async function GET() {
  try {
    const sentences = await prisma.decisionSentence.findMany({
      include: {
        caseDecision: {
          select: {
            klasifikasi: true,
            tahun: true,
          },
        },
      },
    });

    const byType: Record<string, number> = {};
    const byDuration: { range: string; count: number }[] = [];

    for (const s of sentences) {
      byType[s.sentenceType] = (byType[s.sentenceType] ?? 0) + 1;
    }

    return NextResponse.json({
      total: sentences.length,
      byType,
      recent: sentences.slice(0, 20),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
