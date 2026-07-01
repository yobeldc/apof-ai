import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isJobRunning } from "@/lib/ingest";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.ingestionJob.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const urls = await prisma.discoveredUrl.findMany({
    where: { jobId: id },
    orderBy: { discoveredAt: "desc" },
    take: 200,
  });

  return NextResponse.json({
    job: { ...job, logs: JSON.parse(job.logs || "[]") },
    urls,
    running: isJobRunning(id),
  });
}
