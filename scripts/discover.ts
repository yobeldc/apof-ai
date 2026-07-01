/**
 * CLI: discover decision URLs from a seed listing page and persist them.
 *
 *   npm run ingest:discover -- "<seedUrl>" --size small [--dry]
 *
 * Always polite (concurrency 1, randomized delay, robots-aware). Discovery only
 * touches listing pages; it does NOT fetch detail pages.
 */
import { createJob, runIngestionJob } from "../src/lib/ingest";
import { prisma } from "../src/lib/db";
import { isAllowedSource } from "../src/lib/normalize-url";

async function main() {
  const args = process.argv.slice(2);
  const seedUrl = args.find((a) => !a.startsWith("--"));
  const size = (args.find((a) => a.startsWith("--size="))?.split("=")[1] ??
    (args.includes("--size") ? args[args.indexOf("--size") + 1] : "small")) as "small" | "medium" | "large";

  if (!seedUrl) {
    console.error('Usage: npm run ingest:discover -- "<seedUrl>" --size small');
    process.exit(1);
  }
  if (!isAllowedSource(seedUrl)) {
    console.error(`Refused: ${seedUrl} is not on the allowed source host.`);
    process.exit(1);
  }

  const job = await createJob("seed", { seedUrl, seedSize: size, dryRun: true });
  console.log(`Discovery job ${job.id} started (size=${size}, dry run)…`);
  await runIngestionJob(job.id);

  const counts = await prisma.discoveredUrl.count({ where: { jobId: job.id } });
  console.log(`✓ Done. Discovered ${counts} URLs. Run "npm run ingest:run" to fetch detail pages.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
