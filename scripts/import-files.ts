/**
 * OFFLINE IMPORT — parse decision pages/PDFs you saved from your OWN browser.
 *
 *   npm run ingest:import -- "C:\\path\\to\\saved-folder" [--force]
 *
 * Why this exists: the live site (putusan3.mahkamahagung.go.id) blocks automated
 * fetching with a 403 anti-bot challenge. We do NOT bypass that. Instead, you
 * open decisions in your normal browser (where you pass the human check), save
 * them as ".html" (Webpage, HTML Only) and/or download their ".pdf", then drop
 * the files in a folder. This command parses them locally — ZERO network.
 *
 * Reuses the exact same parser, dedup, upsert, and indexing as live ingestion.
 * Resumable + deduplicated: re-running skips files already imported (--force to
 * re-parse).
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { importHtml, importPdf } from "../src/lib/import";
import { prisma } from "../src/lib/db";

async function collectFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await collectFiles(full)));
    else if (/\.(html?|pdf)$/i.test(e.name)) out.push(full);
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith("--"));
  const force = args.includes("--force");

  if (!dir) {
    console.error('Usage: npm run ingest:import -- "<folder>" [--force]');
    process.exit(1);
  }
  const stat = await fs.stat(dir).catch(() => null);
  if (!stat?.isDirectory()) {
    console.error(`Not a folder: ${dir}`);
    process.exit(1);
  }

  const files = await collectFiles(dir);
  console.log(`Found ${files.length} file(s) (.html/.pdf) under ${dir}\n`);

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const isPdf = /\.pdf$/i.test(file);
    const result = isPdf
      ? await importPdf(path.basename(file), new Uint8Array(await fs.readFile(file)), { force })
      : await importHtml(path.basename(file), await fs.readFile(file, "utf8"), { force });

    if (result.outcome === "imported") {
      imported++;
      console.log(`  ✓ ${result.nomorPutusan ?? "(no nomor)"} [${result.extractionStatus}]  ←  ${result.filename}`);
    } else if (result.outcome === "skipped") {
      skipped++;
      console.log(`  skip (exists): ${result.filename}`);
    } else {
      failed++;
      console.log(`  fail: ${result.filename} — ${result.error}`);
    }
  }

  console.log(`\n✓ Import complete. imported=${imported}  skipped=${skipped}  failed=${failed}`);
  console.log(`Open the app and search — the new decisions are indexed locally.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
