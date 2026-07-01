import { Settings as SettingsIcon, Gauge, Search as SearchIcon, Clock } from "lucide-react";
import { env } from "@/lib/env";
import { SettingsPrivacy } from "@/components/settings-privacy";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Settings — Apof.ai" };

export default function SettingsPage() {
  const ing = env.ingestion;
  const rows: [string, string][] = [
    ["Allowed source host", ing.allowedHost],
    ["User-Agent", ing.userAgent],
    ["Concurrency", String(ing.concurrency)],
    ["Delay (min–max)", `${ing.delayMinMs / 1000}s – ${ing.delayMaxMs / 1000}s`],
    ["Max retries", String(ing.maxRetries)],
    ["Backoff base", `${ing.backoffBaseMs / 1000}s`],
    ["Max listing pages / run", String(ing.maxListingPages)],
    ["Max detail pages / run", String(ing.maxDetailPages)],
    ["Allowed hours", ing.allowedHours || "Always"],
    ["Respect robots.txt", ing.respectRobots ? "Yes" : "No"],
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <SettingsIcon className="h-6 w-6 text-primary" /> Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Appearance, privacy, and ingestion configuration.</p>
      </div>

      <SettingsPrivacy />

      {/* Search backend */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Search</h2>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div className="flex items-start gap-3">
              <SearchIcon className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Active search provider</p>
                <p className="text-xs text-muted-foreground">
                  Switch with <code className="rounded bg-muted px-1">SEARCH_PROVIDER</code> in <code className="rounded bg-muted px-1">.env</code>.
                </p>
              </div>
            </div>
            <Badge variant={env.searchProvider === "meili" ? "accent" : "outline"} className="uppercase">
              {env.searchProvider}
            </Badge>
          </CardContent>
        </Card>
      </section>

      {/* Ingestion config (read-only; configured via .env) */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Gauge className="h-4 w-4" /> Ingestion limits
        </h2>
        <Card>
          <CardContent className="p-0">
            <dl className="divide-y">
              {rows.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 px-5 py-3">
                  <dt className="text-sm text-muted-foreground">{k}</dt>
                  <dd className="max-w-[60%] truncate text-right text-sm font-medium" title={v}>{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          These are configured in <code className="rounded bg-muted px-1">.env</code> and applied per run. Keep delays generous to stay polite.
        </p>
      </section>
    </div>
  );
}
