import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const schema = z.object({
  caseId: z.string().min(1),
  save: z.boolean(),
  collectionName: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { caseId, save, collectionName = "Default" } = parsed.data;

  const exists = await prisma.caseDecision.findUnique({ where: { id: caseId }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  if (save) {
    await prisma.savedCase.upsert({
      where: { caseId_collectionName: { caseId, collectionName } },
      update: {},
      create: { caseId, collectionName },
    });
  } else {
    await prisma.savedCase.deleteMany({ where: { caseId, collectionName } });
  }

  return NextResponse.json({ ok: true, saved: save });
}
