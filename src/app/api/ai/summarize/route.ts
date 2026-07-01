import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { summarizeCase } from "@/lib/summarize";
import { toJsonRecord } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { caseId } = (await req.json().catch(() => ({}))) as { caseId?: string };
  if (!caseId) return NextResponse.json({ error: "Missing caseId" }, { status: 400 });

  const c = await prisma.caseDecision.findUnique({ where: { id: caseId } });
  if (!c) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  const summary = await summarizeCase(c);

  await prisma.caseDecision.update({
    where: { id: caseId },
    data: { aiSummary: summary.ringkasan, aiSummaryJson: toJsonRecord(summary) },
  });

  return NextResponse.json({ summary });
}
