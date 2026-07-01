import { prisma } from "./db";
import { env } from "./env";
import { fetchWithPoliteDelay, isWithinAllowedHours, saveRawHtml } from "./fetcher";
import { parseDecisionPage, type ParsedDecision } from "./parse";
import { discoverDecisionUrls, listingPagesForSize, type SeedSize } from "./discover";
import { indexCaseDecision } from "./search";
import { normalizeUrl, isAllowedSource } from "./normalize-url";
import { toJsonList, toJsonRecord } from "./serialize";

/**
 * Ingestion orchestration. runIngestionJob is the resumable entry point.
 * Jobs are cooperative: a per-job AbortController (in jobControllers) lets the
 * /ingestion UI pause/stop a running job in the same Next.js process.
 */

export type LogLevel = "info" | "warn" | "error";
export type LogLine = { ts: string; level: LogLevel; msg: string };

export type JobConfig = {
  // common
  delayMinMs?: number;
  delayMaxMs?: number;
  maxDetailPages?: number;
  dryRun?: boolean;
  // seed mode
  seedUrl?: string;
  seedSize?: SeedSize;
  maxListingPages?: number;
  // url-list modes
  urls?: string[];
  /** Process every pending URL in the queue, not just this job's (CLI runner). */
  processAllPending?: boolean;
};

const jobControllers = new Map<string, AbortController>();

export function stopJob(jobId: string) {
  jobControllers.get(jobId)?.abort();
}
export function isJobRunning(jobId: string) {
  return jobControllers.has(jobId);
}

async function appendLog(jobId: string, level: LogLevel, msg: string) {
  const line: LogLine = { ts: new Date().toISOString(), level, msg };
  const job = await prisma.ingestionJob.findUnique({ where: { id: jobId }, select: { logs: true } });
  const logs: LogLine[] = job ? JSON.parse(job.logs || "[]") : [];
  logs.push(line);
  // Cap retained log lines to keep the row small.
  const trimmed = logs.slice(-500);
  await prisma.ingestionJob.update({ where: { id: jobId }, data: { logs: JSON.stringify(trimmed) } });
}

/** Upsert a parsed decision. Never overwrites an existing row unless forced. */
export async function upsertCaseDecision(
  parsed: ParsedDecision,
  sourceUrl: string,
  rawHtmlPath: string | null,
): Promise<string> {
  const normalized = normalizeUrl(sourceUrl) ?? sourceUrl;
  const domain = (() => {
    try {
      return new URL(normalized).hostname;
    } catch {
      return env.ingestion.allowedHost;
    }
  })();

  const data = {
    sourceUrl: normalized,
    sourceDomain: domain,
    nomorPutusan: parsed.nomorPutusan,
    tingkatProses: parsed.tingkatProses,
    klasifikasi: parsed.klasifikasi,
    kataKunci: toJsonList(parsed.kataKunci),
    tahun: parsed.tahun,
    tanggalRegister: parsed.tanggalRegister,
    tanggalPutusan: parsed.tanggalPutusan,
    tanggalMusyawarah: parsed.tanggalMusyawarah,
    lembagaPeradilan: parsed.lembagaPeradilan,
    jenisLembagaPeradilan: parsed.jenisLembagaPeradilan,
    pengadilan: parsed.pengadilan,
    provinsi: parsed.provinsi,
    hakim: toJsonList(parsed.hakim),
    panitera: parsed.panitera,
    pihak: toJsonList(parsed.pihak),
    pemohon: parsed.pemohon,
    termohon: parsed.termohon,
    terdakwa: parsed.terdakwa,
    penggugat: parsed.penggugat,
    tergugat: parsed.tergugat,
    amarPutusan: parsed.amarPutusan,
    ringkasanSingkat: parsed.ringkasanSingkat,
    fullText: parsed.fullText,
    pdfUrl: parsed.pdfUrl,
    rawHtmlPath,
    hasPdf: !!parsed.pdfUrl,
    hasFullText: !!parsed.fullText,
    extractionStatus: parsed.extractionStatus,
    confidenceJson: toJsonRecord(parsed.confidence),
  };

  const row = await prisma.caseDecision.upsert({
    where: { sourceUrl: normalized },
    update: data,
    create: data,
  });
  return row.id;
}

/** Persist newly discovered URLs (dedup on normalized_url). */
export async function persistDiscoveredUrls(
  items: { url: string; sourcePage: string }[],
  jobId: string,
): Promise<number> {
  let added = 0;
  for (const { url, sourcePage } of items) {
    const normalized = normalizeUrl(url);
    if (!normalized || !isAllowedSource(normalized)) continue;
    try {
      await prisma.discoveredUrl.upsert({
        where: { normalizedUrl: normalized },
        update: {}, // never reset status of an already-known URL
        create: { url, normalizedUrl: normalized, sourcePage, status: "pending", jobId },
      });
      added++;
    } catch {
      /* unique race — ignore */
    }
  }
  return added;
}

/** Fetch + parse + store a single discovered URL. Returns ok/skip/fail. */
async function processDetailUrl(
  normalizedUrl: string,
  jobId: string,
  signal: AbortSignal,
  cfg: JobConfig,
): Promise<"ok" | "failed"> {
  await prisma.discoveredUrl.updateMany({
    where: { normalizedUrl },
    data: { status: "processing", lastAttemptAt: new Date(), attemptCount: { increment: 1 } },
  });

  const res = await fetchWithPoliteDelay(normalizedUrl, {
    signal,
    delayMinMs: cfg.delayMinMs,
    delayMaxMs: cfg.delayMaxMs,
    onLog: (lvl, m) => appendLog(jobId, lvl, m),
  });

  if (!res.ok) {
    await prisma.discoveredUrl.updateMany({
      where: { normalizedUrl },
      data: { status: "failed", errorMessage: res.error ?? `HTTP ${res.status}` },
    });
    await appendLog(jobId, "error", `Failed ${normalizedUrl}: ${res.error ?? res.status}`);
    return "failed";
  }

  const rawPath = res.fromCache ? null : await saveRawHtml(normalizedUrl, res.body);
  const parsed = parseDecisionPage(res.body, normalizedUrl);
  const caseId = await upsertCaseDecision(parsed, normalizedUrl, rawPath);
  await indexCaseDecision(caseId);

  await prisma.discoveredUrl.updateMany({
    where: { normalizedUrl },
    data: { status: "completed", errorMessage: null },
  });
  await appendLog(
    jobId,
    "info",
    `Stored ${parsed.nomorPutusan ?? "(no nomor)"} [${parsed.extractionStatus}] from ${normalizedUrl}`,
  );
  return "ok";
}

/**
 * Run (or resume) an ingestion job to completion, cooperatively. Picks up any
 * pending DiscoveredUrls (so a crashed/paused job is resumable).
 */
export async function runIngestionJob(jobId: string): Promise<void> {
  const job = await prisma.ingestionJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error(`Job ${jobId} not found`);

  const cfg: JobConfig = JSON.parse(job.configJson || "{}");
  const controller = new AbortController();
  jobControllers.set(jobId, controller);
  const signal = controller.signal;

  await prisma.ingestionJob.update({
    where: { id: jobId },
    data: { status: "processing", startedAt: job.startedAt ?? new Date() },
  });
  await appendLog(jobId, "info", `Job started (mode=${job.mode}, dryRun=${!!cfg.dryRun})`);

  try {
    // --- Phase 1: discovery (seed mode) -------------------------------------
    if (job.mode === "seed" && cfg.seedUrl) {
      const size = (cfg.seedSize ?? "small") as SeedSize;
      const maxUrls =
        size === "small" ? 100 : size === "medium" ? 1000 : 10000;
      await discoverDecisionUrls(cfg.seedUrl, {
        maxUrls,
        maxListingPages: cfg.maxListingPages ?? listingPagesForSize(size),
        signal,
        onLog: (lvl, m) => appendLog(jobId, lvl, m),
        onDiscover: async (items) => {
          await persistDiscoveredUrls(items, jobId);
        },
      });
    }

    // --- Phase 2: process pending detail URLs -------------------------------
    if (cfg.dryRun) {
      await appendLog(jobId, "info", "Dry run — discovery only, no detail pages fetched.");
    } else {
      const maxDetail = cfg.maxDetailPages ?? env.ingestion.maxDetailPages;
      let processed = 0;

      while (processed < maxDetail) {
        if (signal.aborted) {
          await appendLog(jobId, "warn", "Job stopped by user.");
          break;
        }
        if (!isWithinAllowedHours()) {
          await appendLog(jobId, "warn", "Outside allowed hours — pausing job.");
          await prisma.ingestionJob.update({ where: { id: jobId }, data: { status: "paused" } });
          return;
        }

        // Pull one pending URL belonging to this job (or any pending in reingest).
        const next = await prisma.discoveredUrl.findFirst({
          where: {
            status: "pending",
            ...(job.mode === "reingest" || cfg.processAllPending ? {} : { jobId }),
          },
          orderBy: { discoveredAt: "asc" },
        });
        if (!next) break;

        const result = await processDetailUrl(next.normalizedUrl, jobId, signal, cfg);
        processed++;

        const counts = await prisma.discoveredUrl.groupBy({
          by: ["status"],
          where: job.mode === "reingest" || cfg.processAllPending ? {} : { jobId },
          _count: true,
        });
        const done = counts.find((c) => c.status === "completed")?._count ?? 0;
        const failed = counts.find((c) => c.status === "failed")?._count ?? 0;
        const total = counts.reduce((s, c) => s + c._count, 0);
        await prisma.ingestionJob.update({
          where: { id: jobId },
          data: { progressDone: done, progressFailed: failed, progressTotal: total },
        });
        if (result === "failed" && processed >= maxDetail) break;
      }
    }

    const finalStatus = signal.aborted ? "stopped" : "completed";
    await prisma.ingestionJob.update({
      where: { id: jobId },
      data: { status: finalStatus, finishedAt: new Date() },
    });
    await appendLog(jobId, "info", `Job ${finalStatus}.`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await appendLog(jobId, "error", `Job crashed: ${msg}`);
    await prisma.ingestionJob.update({
      where: { id: jobId },
      data: { status: "failed", finishedAt: new Date() },
    });
  } finally {
    jobControllers.delete(jobId);
  }
}

/** Create a job row, persisting its config snapshot. */
export async function createJob(mode: string, config: JobConfig) {
  return prisma.ingestionJob.create({
    data: { mode, status: "pending", configJson: JSON.stringify(config) },
  });
}
