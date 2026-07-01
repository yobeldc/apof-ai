import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { answerQuestion } from "@/lib/rag/answer";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const schema = z.object({
  question: z.string().min(2, "Question too short").max(2000),
  caseDecisionId: z.string().optional(),
  filters: z
    .object({
      court: z.string().optional(),
      year: z.number().optional(),
      section: z.string().optional(),
      sectionKind: z.string().optional(),
      caseNumber: z.string().optional(),
      parties: z.array(z.string()).optional(),
      legalArticles: z.array(z.string()).optional(),
    })
    .optional(),
  topK: z.number().int().min(1).max(12).optional(),
});

export async function POST(req: Request) {
  if (!env.rag.enabled) {
    return NextResponse.json({ error: "RAG is disabled (set RAG_ENABLED=true)." }, { status: 503 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", detail: parsed.error.flatten() }, { status: 400 });
  }

  const result = await answerQuestion(parsed.data);
  return NextResponse.json(result);
}
