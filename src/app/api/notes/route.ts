import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { toJsonList } from "@/lib/serialize";

const schema = z.object({
  caseId: z.string().min(1),
  noteId: z.string().optional(),
  title: z.string().optional(),
  body: z.string().default(""),
  tags: z.array(z.string()).default([]),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { caseId, noteId, title, body, tags } = parsed.data;

  const data = { title: title ?? null, body, tags: toJsonList(tags) };
  const note = noteId
    ? await prisma.caseNote.update({ where: { id: noteId }, data })
    : await prisma.caseNote.create({ data: { caseId, ...data } });

  return NextResponse.json({ ok: true, note });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await prisma.caseNote.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
