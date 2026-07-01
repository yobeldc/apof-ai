/**
 * Seed demo data so the UI is fully usable before any real ingestion.
 * Run with: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { DEMO_CASES } from "../src/lib/demo-data";
import { toJsonList, toJsonRecord } from "../src/lib/serialize";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding demo cases…");
  let created = 0;
  for (const c of DEMO_CASES) {
    await prisma.caseDecision.upsert({
      where: { sourceUrl: c.sourceUrl },
      update: {},
      create: {
        sourceUrl: c.sourceUrl,
        sourceDomain: "putusan3.mahkamahagung.go.id",
        nomorPutusan: c.nomorPutusan,
        tingkatProses: c.tingkatProses,
        klasifikasi: c.klasifikasi,
        kataKunci: toJsonList(c.kataKunci),
        tahun: c.tahun,
        tanggalRegister: c.tanggalRegister,
        tanggalPutusan: c.tanggalPutusan,
        tanggalMusyawarah: c.tanggalMusyawarah,
        lembagaPeradilan: c.lembagaPeradilan,
        jenisLembagaPeradilan: c.jenisLembagaPeradilan,
        pengadilan: c.pengadilan,
        provinsi: c.provinsi,
        hakim: toJsonList(c.hakim),
        panitera: c.panitera,
        pihak: toJsonList(c.pihak),
        pemohon: c.pemohon,
        termohon: c.termohon,
        terdakwa: c.terdakwa,
        penggugat: c.penggugat,
        tergugat: c.tergugat,
        amarPutusan: c.amarPutusan,
        ringkasanSingkat: c.ringkasanSingkat,
        fullText: c.fullText,
        pdfUrl: c.pdfUrl,
        hasPdf: !!c.pdfUrl,
        hasFullText: !!c.fullText,
        extractionStatus: c.extractionStatus,
        confidenceJson: toJsonRecord(c.confidence),
        indexedAt: new Date(),
      },
    });
    created++;
  }

  // A couple of recent searches for the dashboard widget.
  for (const q of ["korupsi kasasi", "wanprestasi", "narkotika"]) {
    await prisma.searchHistory.create({ data: { query: q, resultCount: Math.floor(Math.random() * 12) + 1 } });
  }

  // Default settings.
  const defaults: Record<string, string> = {
    privacy_hide_party_names: "false",
    privacy_redaction_mode: "false",
    theme: "system",
  };
  for (const [key, value] of Object.entries(defaults)) {
    await prisma.appSetting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  console.log(`✓ Seeded ${created} demo cases.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
