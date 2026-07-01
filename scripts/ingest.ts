/**
 * CLI: process pending discovered URLs (fetch + parse + index), politely.
 *
 *   npm run ingest:run -- [--max 50] [--reingest]
 *
 * Resumable: picks up wherever the queue left off. Ctrl+C is safe — URLs stay
 * in their current state and can be resumed later.
 */
import { createJob, runIngestionJob } from "../src/lib/ingest";
import { prisma } from "../src/lib/db";

async function main() {
  const args = process.argv.slice(2);
  const maxArg = args.find((a) => a.startsWith("--max="))?.split("=")[1] ??
    (args.includes("--max") ? args[args.indexOf("--max") + 1] : undefined);
  const max = maxArg ? Number(maxArg) : undefined;
  const reingest = args.includes("--reingest");

  if (reingest) {
    const failed = await prisma.discoveredUrl.updateMany({
      where: { status: "failed" },
      data: { status: "pending", errorMessage: null },
    });
    console.log(`Requeued ${failed.count} failed URLs.`);
  }

  const pending = await prisma.discoveredUrl.count({ where: { status: "pending" } });
  if (pending === 0) {
    console.log("No pending URLs. Run discovery or import URLs first.");
    await prisma.$disconnect();
    return;
  }

  const job = await createJob(reingest ? "reingest" : "csv", {
    maxDetailPages: max,
    processAllPending: true,
  });
  console.log(`Ingestion job ${job.id} processing up to ${max ?? "default"} of ${pending} pending URLs…`);
  await runIngestionJob(job.id);

  const done = await prisma.discoveredUrl.count({ where: { status: "completed" } });
  console.log(`✓ Done. ${done} URLs completed in total.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
