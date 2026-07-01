import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createJob, runIngestionJob, persistDiscoveredUrls, type JobConfig } from "@/lib/ingest";
import { normalizeUrl, isAllowedSource } from "@/lib/normalize-url";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  mode: z.enum(["seed", "csv", "paste", "single", "reingest"]),
  config: z.object({
    seedUrl: z.string().optional(),
    seedSize: z.enum(["small", "medium", "large"]).optional(),
    urls: z.array(z.string()).optional(),
    rawText: z.string().optional(),
    delayMinMs: z.number().optional(),
    delayMaxMs: z.number().optional(),
    maxDetailPages: z.number().optional(),
    maxListingPages: z.number().optional(),
    dryRun: z.boolean().optional(),
  }),
});

export async function GET() {
  const [jobs, statusCounts] = await Promise.all([
    prisma.ingestionJob.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.discoveredUrl.groupBy({ by: ["status"], _count: true }),
  ]);
  const queue = { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0 };
  for (const s of statusCounts) {
    if (s.status in queue) queue[s.status as keyof typeof queue] = s._count;
  }
  return NextResponse.json({
    jobs: jobs.map((j) => ({ ...j, logs: undefined })),
    queue,
  });
}

export async function POST(req: Request) {
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", detail: parsed.error.flatten() }, { status: 400 });
  }
  const { mode, config } = parsed.data;

  // Collect explicit URLs for the list-based modes.
  let urls: string[] = config.urls ?? [];
  if (config.rawText) {
    urls = urls.concat(config.rawText.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean));
  }
  const normalized = Array.from(
    new Set(urls.map((u) => normalizeUrl(u)).filter((u): u is string => !!u && isAllowedSource(u))),
  );

  if ((mode === "csv" || mode === "paste" || mode === "single") && normalized.length === 0) {
    return NextResponse.json(
      { error: "No valid URLs on the allowed source were provided." },
      { status: 400 },
    );
  }
  if (mode === "seed") {
    const seed = config.seedUrl ? normalizeUrl(config.seedUrl) : null;
    if (!seed || !isAllowedSource(seed)) {
      return NextResponse.json({ error: "Seed URL must be on the allowed source host." }, { status: 400 });
    }
  }

  const jobConfig: JobConfig = {
    seedUrl: config.seedUrl,
    seedSize: config.seedSize,
    delayMinMs: config.delayMinMs,
    delayMaxMs: config.delayMaxMs,
    maxDetailPages: config.maxDetailPages,
    maxListingPages: config.maxListingPages,
    dryRun: config.dryRun,
    urls: normalized,
  };

  const job = await createJob(mode, jobConfig);

  // Pre-seed the queue for list modes so URLs are saved BEFORE any fetch.
  if (normalized.length) {
    await persistDiscoveredUrls(
      normalized.map((url) => ({ url, sourcePage: `job:${mode}` })),
      job.id,
    );
    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: { progressTotal: normalized.length },
    });
  }

  // Fire-and-forget the runner (cooperative; resumable if it dies).
  runIngestionJob(job.id).catch((err) => console.error("[ingestion] job failed:", err));

  return NextResponse.json({ ok: true, jobId: job.id });
}
