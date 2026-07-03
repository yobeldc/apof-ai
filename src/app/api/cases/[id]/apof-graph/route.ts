import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/cases/[id]/apof-graph
 * Returns the Apof Graph extraction for a case, including normalized data.
 *
 * DELETE /api/cases/[id]/apof-graph
 * Deletes the extraction and resets the case status.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const caseDecision = await prisma.caseDecision.findUnique({
      where: { id },
      select: {
        id: true,
        apofGraphStatus: true,
        apofGraphVersion: true,
        nomorPutusan: true,
      },
    });

    if (!caseDecision) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const extraction = await prisma.apofGraphExtraction.findUnique({
      where: { caseDecisionId: id },
    });

    if (!extraction) {
      return NextResponse.json({
        extraction: null,
        status: caseDecision.apofGraphStatus,
      });
    }

    // Fetch normalized data
    const [judges, issues, articles, sentences] = await Promise.all([
      prisma.decisionJudge.findMany({
        where: { caseDecisionId: id },
        include: { judge: true },
      }),
      prisma.decisionLegalIssue.findMany({
        where: { caseDecisionId: id },
        include: { legalIssue: true },
      }),
      prisma.decisionArticle.findMany({
        where: { caseDecisionId: id },
        include: { statuteArticle: { include: { statute: true } } },
      }),
      prisma.decisionSentence.findMany({
        where: { caseDecisionId: id },
      }),
    ]);

    return NextResponse.json({
      extraction: {
        ...JSON.parse(extraction.fullJson),
        confidence: JSON.parse(extraction.confidenceJson),
        unsupportedFields: JSON.parse(extraction.unsupportedFieldsJson),
        evidenceSpans: JSON.parse(extraction.evidenceSpansJson),
      },
      status: caseDecision.apofGraphStatus,
      version: extraction.schemaVersion,
      normalized: {
        judges: judges.map((j) => ({
          name: j.judge.name,
          title: j.judge.title,
          role: j.role,
        })),
        issues: issues.map((i) => ({
          label: i.legalIssue.label,
          category: i.legalIssue.category,
          confidence: i.confidence,
        })),
        articles: articles.map((a) => ({
          statute: a.statuteArticle.statute.name,
          article: a.statuteArticle.articleNumber,
          context: a.context,
        })),
        sentences: sentences.map((s) => ({
          type: s.sentenceType,
          durationMonths: s.durationMonths,
          fineAmount: s.fineAmount,
          restitutionAmount: s.restitutionAmount,
        })),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.$transaction(async (tx) => {
      await tx.apofGraphExtraction.deleteMany({
        where: { caseDecisionId: id },
      });
      await tx.decisionJudge.deleteMany({ where: { caseDecisionId: id } });
      await tx.decisionLegalIssue.deleteMany({
        where: { caseDecisionId: id },
      });
      await tx.decisionArticle.deleteMany({
        where: { caseDecisionId: id },
      });
      await tx.decisionSentence.deleteMany({
        where: { caseDecisionId: id },
      });
      await tx.caseDecision.update({
        where: { id },
        data: {
          apofGraphStatus: "pending",
          apofGraphVersion: null,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
