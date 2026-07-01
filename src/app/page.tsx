import Link from "next/link";
import {
  FileStack,
  FileText,
  Bookmark,
  AlertTriangle,
  Database,
  Search,
  ArrowUpRight,
  Clock,
  Layers,
  ScrollText,
} from "lucide-react";
import { getDashboardStats } from "@/lib/stats";
import { StatTile } from "@/components/stat-tile";
import { YearDistributionChart } from "@/components/year-distribution-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataQualityBadge } from "@/components/data-quality-badge";
import { EmptyState } from "@/components/empty-state";
import { GlobalSearch } from "@/components/global-search";
import { orDash } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const s = await getDashboardStats();
  const isEmpty = s.totalCases === 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card to-muted/40 p-6 md:p-8">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" aria-hidden />
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="relative">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight md:text-[1.75rem]">
                Apof.ai
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Your local research command center for Indonesian court decisions.{" "}
                <span className="text-foreground/70">Mahkamah Agung is the source of truth.</span>
              </p>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href="/ingestion">
                  <Database className="h-4 w-4" /> Ingest data
                </Link>
              </Button>
            </div>
          </div>
          <div className="mt-5 max-w-2xl">
            <GlobalSearch />
          </div>
        </div>
      </div>

      {isEmpty ? (
        <EmptyState
          icon={FileStack}
          title="No decisions indexed yet"
          description="Seed demo data to explore the interface, or start a small, polite ingestion run from the official site."
          action={
            <>
              <Button asChild variant="outline">
                <Link href="/ingestion">Start ingestion</Link>
              </Button>
              <code className="rounded-md border bg-muted px-2 py-1 text-xs">npm run db:seed</code>
            </>
          }
        />
      ) : (
        <>
          {/* Bento stat row */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Indexed decisions" value={s.totalCases.toLocaleString()} icon={FileStack} hint={`${s.withFullText} with full text`} />
            <StatTile label="With PDF" value={s.withPdf.toLocaleString()} icon={FileText} accent="accent" hint="Original documents available" />
            <StatTile label="Saved cases" value={s.savedCount.toLocaleString()} icon={Bookmark} accent="success" hint="In your collections" />
            <StatTile label="Failed URLs" value={s.failedUrls.toLocaleString()} icon={AlertTriangle} accent={s.failedUrls > 0 ? "destructive" : "primary"} hint={`${s.pendingUrls} pending in queue`} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Year distribution */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-muted-foreground" /> Decisions by year
                </CardTitle>
              </CardHeader>
              <CardContent>
                <YearDistributionChart data={s.yearDistribution} />
              </CardContent>
            </Card>

            {/* Ingestion progress */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="h-4 w-4 text-muted-foreground" /> Latest ingestion
                </CardTitle>
              </CardHeader>
              <CardContent>
                {s.latestJob ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="capitalize">{s.latestJob.mode}</Badge>
                      <StatusPill status={s.latestJob.status} />
                    </div>
                    <Progress done={s.latestJob.progressDone} total={s.latestJob.progressTotal} />
                    <div className="flex justify-between text-xs text-muted-foreground tabular">
                      <span>{s.latestJob.progressDone} done</span>
                      <span>{s.latestJob.progressFailed} failed</span>
                      <span>{s.latestJob.progressTotal} total</span>
                    </div>
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link href={`/ingestion/jobs/${s.latestJob.id}`}>View job</Link>
                    </Button>
                  </div>
                ) : (
                  <p className="py-4 text-sm text-muted-foreground">
                    No ingestion runs yet. The app works fully on demo data.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Recently added */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ScrollText className="h-4 w-4 text-muted-foreground" /> Recently added
                </CardTitle>
                <Link href="/search?sort=recent" className="text-xs text-primary hover:underline">
                  View all
                </Link>
              </CardHeader>
              <CardContent className="space-y-1">
                {s.recentCases.map((c) => (
                  <Link
                    key={c.id}
                    href={`/cases/${c.id}`}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-muted"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-medium">{orDash(c.nomorPutusan)}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {orDash(c.pengadilan)} · {orDash(c.klasifikasi)} · {orDash(c.tahun)}
                      </p>
                    </div>
                    <DataQualityBadge status={c.extractionStatus} />
                  </Link>
                ))}
              </CardContent>
            </Card>

            {/* Top classifications + recent searches */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Layers className="h-4 w-4 text-muted-foreground" /> Top classifications
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {s.topClassifications.length === 0 && (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                  {s.topClassifications.map((k) => (
                    <Link
                      key={k.label}
                      href={`/search?klasifikasi=${encodeURIComponent(k.label)}`}
                      className="flex items-center justify-between text-sm hover:text-primary"
                    >
                      <span className="truncate">{k.label}</span>
                      <span className="tabular text-muted-foreground">{k.count}</span>
                    </Link>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Search className="h-4 w-4 text-muted-foreground" /> Recent searches
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {s.recentSearches.length === 0 && (
                    <p className="text-sm text-muted-foreground">No searches yet</p>
                  )}
                  {s.recentSearches.map((q) => (
                    <Link key={q.id} href={`/search?q=${encodeURIComponent(q.query)}`}>
                      <Badge variant="outline" className="gap-1 hover:bg-muted">
                        {q.query}
                        <ArrowUpRight className="h-3 w-3" />
                      </Badge>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Progress({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const variant =
    status === "completed" ? "success"
    : status === "processing" ? "accent"
    : status === "failed" ? "destructive"
    : status === "paused" || status === "stopped" ? "warning"
    : "outline";
  return <Badge variant={variant as any} className="capitalize">{status}</Badge>;
}
