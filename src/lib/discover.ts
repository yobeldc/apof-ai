import * as cheerio from "cheerio";
import { fetchWithPoliteDelay } from "./fetcher";
import { isAllowedSource, looksLikeDetailUrl, normalizeUrl } from "./normalize-url";
import { env } from "./env";

export type DiscoverOptions = {
  maxUrls: number;
  maxListingPages: number;
  signal?: AbortSignal;
  onLog?: (level: "info" | "warn" | "error", msg: string) => void;
  onDiscover?: (urls: { url: string; sourcePage: string }[]) => Promise<void> | void;
};

export type DiscoverResult = {
  urls: string[];
  listingPagesVisited: number;
  stoppedReason: string;
};

/** Extract candidate decision-detail links from one listing/search page. */
export function extractDetailLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const base = normalizeUrl(baseUrl) ?? baseUrl;
  const found = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    let abs: string;
    try {
      abs = new URL(href, base).toString();
    } catch {
      return;
    }
    const normalized = normalizeUrl(abs);
    if (!normalized) return;
    if (isAllowedSource(normalized) && looksLikeDetailUrl(normalized)) {
      found.add(normalized);
    }
  });
  return Array.from(found);
}

/** Find the "next page" link from a listing page (pagination). */
export function extractNextPage(html: string, baseUrl: string): string | null {
  const $ = cheerio.load(html);
  const base = normalizeUrl(baseUrl) ?? baseUrl;
  let next: string | null = null;

  // rel=next, or an anchor labeled »/Next/Berikutnya, or ?page=N+1.
  const candidate =
    $('a[rel="next"]').attr("href") ||
    $('a[aria-label*="Next" i]').attr("href") ||
    $("a.next, li.next a").attr("href");
  if (candidate) {
    try {
      next = normalizeUrl(new URL(candidate, base).toString());
    } catch {
      next = null;
    }
  }
  if (!next) {
    $("a").each((_, el) => {
      if (next) return;
      const t = $(el).text().trim().toLowerCase();
      if (t === "»" || t === "next" || t === "berikutnya" || t === "selanjutnya") {
        const href = $(el).attr("href");
        if (href) {
          try {
            next = normalizeUrl(new URL(href, base!).toString());
          } catch {
            next = null;
          }
        }
      }
    });
  }
  return next;
}

/**
 * Discover decision detail URLs starting from a safe public listing/search/
 * category page. Walks pagination slowly (through the polite fetcher), stops at
 * maxUrls or maxListingPages, dedupes, and streams results to onDiscover so
 * they're persisted BEFORE any detail fetch.
 */
export async function discoverDecisionUrls(
  seedUrl: string,
  options: DiscoverOptions,
): Promise<DiscoverResult> {
  const { maxUrls, maxListingPages, signal, onLog, onDiscover } = options;
  const seedNorm = normalizeUrl(seedUrl);
  if (!seedNorm || !isAllowedSource(seedNorm)) {
    return { urls: [], listingPagesVisited: 0, stoppedReason: "Seed URL is not an allowed source" };
  }

  const discovered = new Set<string>();
  const visitedPages = new Set<string>();
  let current: string | null = seedNorm;
  let pages = 0;
  let stoppedReason = "Reached end of listing";

  while (current && pages < maxListingPages && discovered.size < maxUrls) {
    if (signal?.aborted) {
      stoppedReason = "Stopped by user";
      break;
    }
    if (visitedPages.has(current)) {
      stoppedReason = "Pagination loop detected";
      break;
    }
    visitedPages.add(current);

    onLog?.("info", `Discovering from listing page ${pages + 1}: ${current}`);
    const res = await fetchWithPoliteDelay(current, { signal, onLog });
    pages++;
    if (!res.ok) {
      stoppedReason = `Listing fetch failed: ${res.error ?? res.status}`;
      onLog?.("error", stoppedReason);
      break;
    }

    const links = extractDetailLinks(res.body, current).filter((u) => !discovered.has(u));
    const room = maxUrls - discovered.size;
    const take = links.slice(0, room);
    take.forEach((u) => discovered.add(u));
    if (take.length) {
      onLog?.("info", `Found ${take.length} new decision URLs (total ${discovered.size}/${maxUrls})`);
      await onDiscover?.(take.map((url) => ({ url, sourcePage: current! })));
    } else {
      onLog?.("warn", `No new decision URLs on this page`);
    }

    if (discovered.size >= maxUrls) {
      stoppedReason = `Reached target of ${maxUrls} URLs`;
      break;
    }

    current = extractNextPage(res.body, current);
    if (!current) stoppedReason = "No further pagination found";
  }

  if (pages >= maxListingPages) stoppedReason = `Reached max listing pages (${maxListingPages})`;

  return { urls: Array.from(discovered), listingPagesVisited: pages, stoppedReason };
}

/** Run-size presets for the Seed Explorer. */
export const SEED_PRESETS = {
  small: { maxUrls: 100, label: "Small", description: "Up to 100 decision URLs" },
  medium: { maxUrls: 1000, label: "Medium", description: "Up to 1,000 decision URLs" },
  large: { maxUrls: 10000, label: "Large", description: "Up to 10,000 — very slow & resumable" },
} as const;

export type SeedSize = keyof typeof SEED_PRESETS;

export function listingPagesForSize(size: SeedSize): number {
  // putusan3 lists ~20 per page; cap generously but rely on maxUrls to stop.
  const perPage = 20;
  const target = SEED_PRESETS[size].maxUrls;
  return Math.min(Math.ceil(target / perPage) + 5, size === "large" ? 600 : env.ingestion.maxListingPages * 50);
}
