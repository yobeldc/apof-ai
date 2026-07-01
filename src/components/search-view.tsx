"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  SlidersHorizontal,
  X,
  FileText,
  ScrollText,
  Bookmark,
  Loader2,
  SearchX,
} from "lucide-react";
import type { SearchResponse, SortKey } from "@/lib/search";
import { CaseResultCard } from "@/components/case-result-card";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Filters = {
  q: string;
  year: string[];
  court: string[];
  klasifikasi: string[];
  tingkat: string[];
  hasPdf: boolean;
  hasFullText: boolean;
  saved: boolean;
  sort: SortKey;
};

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "newest", label: "Newest decision" },
  { value: "oldest", label: "Oldest decision" },
  { value: "recent", label: "Recently added" },
];

function readFilters(sp: URLSearchParams): Filters {
  const list = (k: string) => (sp.get(k) ? sp.get(k)!.split(",").filter(Boolean) : []);
  return {
    q: sp.get("q") ?? "",
    year: list("year"),
    court: list("court"),
    klasifikasi: list("klasifikasi"),
    tingkat: list("tingkat"),
    hasPdf: sp.get("hasPdf") === "true",
    hasFullText: sp.get("hasFullText") === "true",
    saved: sp.get("saved") === "true",
    sort: (sp.get("sort") as SortKey) ?? "relevance",
  };
}

function toQuery(f: Filters, page = 1): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.year.length) p.set("year", f.year.join(","));
  if (f.court.length) p.set("court", f.court.join(","));
  if (f.klasifikasi.length) p.set("klasifikasi", f.klasifikasi.join(","));
  if (f.tingkat.length) p.set("tingkat", f.tingkat.join(","));
  if (f.hasPdf) p.set("hasPdf", "true");
  if (f.hasFullText) p.set("hasFullText", "true");
  if (f.saved) p.set("saved", "true");
  if (f.sort !== "relevance") p.set("sort", f.sort);
  if (page > 1) p.set("page", String(page));
  return p.toString();
}

const SUGGESTIONS = ["korupsi", "wanprestasi", "narkotika", "perbuatan melawan hukum", "PHK", "kasasi"];

export function SearchView() {
  const router = useRouter();
  const sp = useSearchParams();
  const [filters, setFilters] = React.useState<Filters>(() => readFilters(new URLSearchParams(sp.toString())));
  const [input, setInput] = React.useState(filters.q);
  const [data, setData] = React.useState<SearchResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(Number(sp.get("page") ?? 1));
  const [showFilters, setShowFilters] = React.useState(false);

  // Sync state from URL when it changes externally.
  React.useEffect(() => {
    const f = readFilters(new URLSearchParams(sp.toString()));
    setFilters(f);
    setInput(f.q);
    setPage(Number(sp.get("page") ?? 1));
  }, [sp]);

  const fetchResults = React.useCallback(async (f: Filters, p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/search?${toQuery(f, p)}`);
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchResults(filters, page);
  }, [filters, page, fetchResults]);

  const commit = (next: Filters, resetPage = true) => {
    const p = resetPage ? 1 : page;
    setFilters(next);
    if (resetPage) setPage(1);
    router.replace(`/search${toQuery(next, p) ? `?${toQuery(next, p)}` : ""}`, { scroll: false });
  };

  // Debounced query commit
  React.useEffect(() => {
    const t = setTimeout(() => {
      if (input !== filters.q) commit({ ...filters, q: input });
    }, 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  const toggleArr = (key: "year" | "court" | "klasifikasi" | "tingkat", value: string) => {
    const cur = filters[key];
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    commit({ ...filters, [key]: next });
  };

  const activeChips: { key: string; label: string; clear: () => void }[] = [];
  filters.year.forEach((y) => activeChips.push({ key: `y${y}`, label: `Year ${y}`, clear: () => toggleArr("year", y) }));
  filters.court.forEach((c) => activeChips.push({ key: `c${c}`, label: c, clear: () => toggleArr("court", c) }));
  filters.klasifikasi.forEach((k) => activeChips.push({ key: `k${k}`, label: k, clear: () => toggleArr("klasifikasi", k) }));
  filters.tingkat.forEach((t) => activeChips.push({ key: `t${t}`, label: t, clear: () => toggleArr("tingkat", t) }));
  if (filters.hasPdf) activeChips.push({ key: "pdf", label: "Has PDF", clear: () => commit({ ...filters, hasPdf: false }) });
  if (filters.hasFullText) activeChips.push({ key: "ft", label: "Has full text", clear: () => commit({ ...filters, hasFullText: false }) });
  if (filters.saved) activeChips.push({ key: "sv", label: "Saved only", clear: () => commit({ ...filters, saved: false }) });

  const clearAll = () =>
    commit({ q: input, year: [], court: [], klasifikasi: [], tingkat: [], hasPdf: false, hasFullText: false, saved: false, sort: filters.sort });

  const facets = data?.facets;

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      {/* Search bar */}
      <div className="sticky top-14 z-20 -mx-4 mb-4 bg-background/85 px-4 py-3 backdrop-blur-md md:-mx-6 md:px-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            id="global-search-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
            placeholder="Search putusan, nomor, parties, court, keywords…"
            aria-label="Search decisions"
            className="h-14 w-full rounded-xl border border-input bg-card pl-12 pr-28 text-base shadow-sm outline-none transition-all placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {input && (
              <Button variant="ghost" size="icon-sm" onClick={() => setInput("")} aria-label="Clear">
                <X className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 lg:hidden"
              onClick={() => setShowFilters((v) => !v)}
            >
              <SlidersHorizontal className="h-4 w-4" /> Filters
            </Button>
          </div>
        </div>

        {/* Result meta + sort */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground tabular">
            {loading ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
              </span>
            ) : data ? (
              <>
                <span className="font-medium text-foreground">{data.total.toLocaleString()}</span> results · {data.tookMs}ms
                <span className="ml-1 text-xs">({data.provider})</span>
              </>
            ) : null}
          </p>
          <div className="flex items-center gap-2">
            <label htmlFor="sort" className="text-xs text-muted-foreground">
              Sort
            </label>
            <select
              id="sort"
              value={filters.sort}
              onChange={(e) => commit({ ...filters, sort: e.target.value as SortKey })}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active chips */}
        {activeChips.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                onClick={chip.clear}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
              >
                {chip.label}
                <X className="h-3 w-3" />
              </button>
            ))}
            <button onClick={clearAll} className="px-2 text-xs text-muted-foreground hover:text-foreground">
              Clear all
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-6">
        {/* Filter panel */}
        <aside
          className={cn(
            "w-60 shrink-0 lg:block",
            showFilters ? "fixed inset-0 z-40 block w-full bg-background p-4 lg:static lg:z-auto lg:w-60 lg:p-0" : "hidden",
          )}
        >
          {showFilters && (
            <div className="mb-3 flex items-center justify-between lg:hidden">
              <span className="font-semibold">Filters</span>
              <Button variant="ghost" size="icon-sm" onClick={() => setShowFilters(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div className="space-y-5 lg:sticky lg:top-44">
            <FilterGroup title="Quick filters">
              <Toggle label="Has PDF" icon={FileText} checked={filters.hasPdf} onChange={(v) => commit({ ...filters, hasPdf: v })} />
              <Toggle label="Has full text" icon={ScrollText} checked={filters.hasFullText} onChange={(v) => commit({ ...filters, hasFullText: v })} />
              <Toggle label="Saved only" icon={Bookmark} checked={filters.saved} onChange={(v) => commit({ ...filters, saved: v })} />
            </FilterGroup>

            {facets?.klasifikasi.length ? (
              <FilterGroup title="Klasifikasi">
                <FacetList items={facets.klasifikasi} active={filters.klasifikasi} onToggle={(v) => toggleArr("klasifikasi", v)} />
              </FilterGroup>
            ) : null}

            {facets?.tingkatProses.length ? (
              <FilterGroup title="Tingkat Proses">
                <FacetList items={facets.tingkatProses} active={filters.tingkat} onToggle={(v) => toggleArr("tingkat", v)} />
              </FilterGroup>
            ) : null}

            {facets?.years.length ? (
              <FilterGroup title="Year">
                <FacetList items={facets.years.map((y) => ({ value: String(y.value), count: y.count }))} active={filters.year} onToggle={(v) => toggleArr("year", v)} />
              </FilterGroup>
            ) : null}

            {facets?.courts.length ? (
              <FilterGroup title="Court">
                <FacetList items={facets.courts} active={filters.court} onToggle={(v) => toggleArr("court", v)} max={8} />
              </FilterGroup>
            ) : null}
          </div>
        </aside>

        {/* Results */}
        <div className="min-w-0 flex-1">
          {loading && !data ? (
            <ResultSkeletons />
          ) : error ? (
            <ErrorState title="Search failed" description={error} onRetry={() => fetchResults(filters, page)} />
          ) : data && data.hits.length === 0 ? (
            filters.q || activeChips.length ? (
              <EmptyState
                icon={SearchX}
                title="No matching decisions"
                description="Try broader terms, search by nomor putusan, or clear some filters."
                action={<Button variant="outline" onClick={clearAll}>Clear filters</Button>}
              />
            ) : (
              <ZeroState onPick={(q) => setInput(q)} />
            )
          ) : (
            <>
              <div className={cn("space-y-3 transition-opacity", loading && "opacity-60")}>
                <AnimatePresence mode="popLayout">
                  {data!.hits.map((hit, i) => (
                    <CaseResultCard key={hit.id} hit={hit} index={i} />
                  ))}
                </AnimatePresence>
              </div>

              {/* Pagination */}
              {data && data.total > data.pageSize && (
                <div className="mt-6 flex items-center justify-center gap-3">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground tabular">
                    Page {page} / {Math.ceil(data.total / data.pageSize)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= Math.ceil(data.total / data.pageSize)}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Toggle({
  label,
  icon: Icon,
  checked,
  onChange,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted">
      <span className="inline-flex items-center gap-2 text-foreground/80">
        <Icon className="h-4 w-4 text-muted-foreground" /> {label}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function FacetList({
  items,
  active,
  onToggle,
  max = 12,
}: {
  items: { value: string; count: number }[];
  active: string[];
  onToggle: (v: string) => void;
  max?: number;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const shown = expanded ? items : items.slice(0, max);
  return (
    <div className="space-y-0.5">
      {shown.map((item) => {
        const on = active.includes(item.value);
        return (
          <button
            key={item.value}
            onClick={() => onToggle(item.value)}
            className={cn(
              "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors",
              on ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground/80",
            )}
          >
            <span className="truncate text-left">{item.value}</span>
            <span className="ml-2 shrink-0 text-xs text-muted-foreground tabular">{item.count}</span>
          </button>
        );
      })}
      {items.length > max && (
        <button onClick={() => setExpanded((v) => !v)} className="px-2 pt-1 text-xs text-primary hover:underline">
          {expanded ? "Show less" : `Show ${items.length - max} more`}
        </button>
      )}
    </div>
  );
}

function ResultSkeletons() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-5">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="mt-2 h-3 w-32" />
          <div className="mt-3 flex gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-3 w-full" />
          <Skeleton className="mt-1.5 h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}

function ZeroState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <EmptyState
        icon={Search}
        title="Search Indonesian court decisions"
        description="Search by nomor putusan, parties, court, classification, or full text. Try one of these to start:"
        action={
          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => onPick(s)}>
                <Badge variant="outline" className="cursor-pointer px-3 py-1 hover:bg-muted">
                  {s}
                </Badge>
              </button>
            ))}
          </div>
        }
      />
    </motion.div>
  );
}
