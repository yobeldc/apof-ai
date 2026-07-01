import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateBreakdown } from "@/lib/legal/breakdown";

export const dynamic = "force-dynamic";

const schema = z.object({ force: z.boolean().optional().default(false) });

/** GET: return a cached breakdown if present (else 404). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.caseAnalysis.findUnique({ where: { caseDecisionId: id } });
  if (!existing) return NextResponse.json({ breakdown: null });
  return NextResponse.json({ breakdown: JSON.parse(existing.breakdownJson) });
}

/** POST: compute (deterministic) + cache + return the breakdown. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    const breakdown = await generateBreakdown(id, { force: parsed.data.force });
    return NextResponse.json({ ok: true, breakdown });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Breakdown failed" }, { status: 500 });
  }
}
