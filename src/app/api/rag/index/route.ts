import { NextResponse } from "next/server";
import { z } from "zod";
import { indexCase, indexAllCases } from "@/lib/rag/index";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const schema = z.object({
  caseDecisionId: z.string().optional(),
  force: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", detail: parsed.error.flatten() }, { status: 400 });
  }
  const { caseDecisionId, force } = parsed.data;

  try {
    if (caseDecisionId) {
      const result = await indexCase(caseDecisionId, { force });
      return NextResponse.json({ ok: true, scope: "case", results: [result] });
    }
    const results = await indexAllCases({ force });
    const totals = results.reduce(
      (acc, r) => ({ chunks: acc.chunks + r.chunks, embedded: acc.embedded + r.embedded, pages: acc.pages + r.pages }),
      { chunks: 0, embedded: 0, pages: 0 },
    );
    return NextResponse.json({ ok: true, scope: "all", cases: results.length, totals, results });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Indexing failed" }, { status: 500 });
  }
}
