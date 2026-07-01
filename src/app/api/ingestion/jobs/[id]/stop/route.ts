import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stopJob, runIngestionJob } from "@/lib/ingest";

export const dynamic = "force-dynamic";

/** POST { action: "stop" | "resume" } */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };

  const job = await prisma.ingestionJob.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "resume") {
    if (job.status === "completed") {
      return NextResponse.json({ error: "Job already completed" }, { status: 400 });
    }
    runIngestionJob(id).catch((err) => console.error("[ingestion] resume failed:", err));
    return NextResponse.json({ ok: true, status: "processing" });
  }

  // default: stop
  stopJob(id);
  await prisma.ingestionJob.update({ where: { id }, data: { status: "stopped" } });
  return NextResponse.json({ ok: true, status: "stopped" });
}
