/**
 * CLI: (re)index all cases into the active search backend.
 * For the local SQLite provider this just stamps indexed_at; for Meilisearch it
 * pushes documents and configures searchable/filterable/sortable attributes.
 *
 *   npm run search:reindex
 */
import { prisma } from "../src/lib/db";
import { env } from "../src/lib/env";
import { indexCaseDecision } from "../src/lib/search";

async function configureMeili() {
  const { MeiliSearch } = await import("meilisearch");
  const client = new MeiliSearch({ host: env.meili.host, apiKey: env.meili.apiKey || undefined });
  const index = client.index(env.meili.index);
  await index.updateSearchableAttributes([
    "nomor_putusan", "pihak", "amar_putusan", "full_text",
    "klasifikasi", "kata_kunci", "pengadilan", "hakim",
  ]);
  await index.updateFilterableAttributes([
    "tahun", "tingkat_proses", "klasifikasi", "pengadilan", "has_pdf", "extraction_status",
  ]);
  await index.updateSortableAttributes(["tanggal_putusan", "tahun", "created_at"]);
  console.log("Configured Meilisearch index attributes.");
}

async function main() {
  if (env.searchProvider === "meili") {
    console.log(`Configuring Meilisearch at ${env.meili.host} …`);
    await configureMeili();
  } else {
    console.log("Search provider is 'local' (SQLite). Stamping indexed_at for all cases.");
  }

  const ids = await prisma.caseDecision.findMany({ select: { id: true } });
  let n = 0;
  for (const { id } of ids) {
    await indexCaseDecision(id);
    n++;
    if (n % 50 === 0) console.log(`  indexed ${n}/${ids.length}`);
  }
  console.log(`✓ Reindexed ${n} cases.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
