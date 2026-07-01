import { prisma } from "./db";

export async function getDashboardStats() {
  const [
    totalCases,
    withPdf,
    withFullText,
    savedCount,
    failedUrls,
    pendingUrls,
    recentCases,
    recentSearches,
    latestJob,
    klasGroups,
    yearGroups,
  ] = await Promise.all([
    prisma.caseDecision.count(),
    prisma.caseDecision.count({ where: { hasPdf: true } }),
    prisma.caseDecision.count({ where: { hasFullText: true } }),
    prisma.savedCase.count(),
    prisma.discoveredUrl.count({ where: { status: "failed" } }),
    prisma.discoveredUrl.count({ where: { status: "pending" } }),
    prisma.caseDecision.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        nomorPutusan: true,
        pengadilan: true,
        klasifikasi: true,
        tahun: true,
        extractionStatus: true,
        sourceUrl: true,
      },
    }),
    prisma.searchHistory.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.ingestionJob.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.caseDecision.groupBy({ by: ["klasifikasi"], _count: true }),
    prisma.caseDecision.groupBy({ by: ["tahun"], _count: true }),
  ]);

  const topClassifications = klasGroups
    .filter((g) => g.klasifikasi)
    .map((g) => ({ label: g.klasifikasi as string, count: g._count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const yearDistribution = yearGroups
    .filter((g) => g.tahun)
    .map((g) => ({ year: g.tahun as number, count: g._count }))
    .sort((a, b) => a.year - b.year);

  // De-dup recent searches by query, keep most recent.
  const seen = new Set<string>();
  const dedupSearches = recentSearches.filter((s) => {
    if (seen.has(s.query)) return false;
    seen.add(s.query);
    return true;
  });

  return {
    totalCases,
    withPdf,
    withFullText,
    savedCount,
    failedUrls,
    pendingUrls,
    recentCases,
    recentSearches: dedupSearches,
    latestJob,
    topClassifications,
    yearDistribution,
  };
}
