/**
 * Apof.ai RAG indexing CLI — extract pages → normalize → chunk → embed.
 * Works fully in mock mode (no external services).
 *
 *   npm run rag:index                       # index all cases
 *   npm run rag:index -- --case-id CASE_ID  # index one case
 *   npm run rag:index -- --force            # re-extract + re-chunk + re-embed
 */
import { indexCase, indexAllCases, getRagStatus } from "../src/lib/rag/index";
import { prisma } from "../src/lib/db";

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const caseId =
    args.find((a) => a.startsWith("--case-id="))?.split("=")[1] ??
    (args.includes("--case-id") ? args[args.indexOf("--case-id") + 1] : undefined);

  const status = await getRagStatus();
  console.log(
    `RAG config: embeddings=${status.embeddingProvider}/${status.embeddingModel} · vector=${status.vectorProvider} · llm=${status.llmProvider}/${status.llmModel}`,
  );
  status.warnings.forEach((w) => console.log(`  ⚠ ${w}`));

  if (caseId) {
    const r = await indexCase(caseId, { force });
    console.log(`\n${r.skipped ? "skip" : "✓"} ${r.caseNumber ?? r.caseDecisionId}: pages=${r.pages} chunks=${r.chunks} embedded=${r.embedded}`);
    r.warnings.forEach((w) => console.log(`    ⚠ ${w}`));
  } else {
    console.log("\nIndexing all cases…");
    const results = await indexAllCases({ force });
    let chunks = 0, embedded = 0;
    for (const r of results) {
      chunks += r.chunks;
      embedded += r.embedded;
      console.log(`  ${r.skipped ? "skip" : "✓"} ${r.caseNumber ?? r.caseDecisionId}: pages=${r.pages} chunks=${r.chunks} embedded=${r.embedded}`);
    }
    console.log(`\n✓ Done. ${results.length} cases · ${chunks} chunks · ${embedded} embedded.`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
