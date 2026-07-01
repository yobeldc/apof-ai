import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { env } from "./env";
import { isAllowedSource, normalizeUrl } from "./normalize-url";
import { sleep } from "./utils";

/**
 * THE single polite fetcher. Every network request in this app goes through
 * here — no scattered fetch() calls. It enforces:
 *  - allow-listed source host only
 *  - robots.txt compliance (cached)
 *  - global throttle: one request at a time, randomized delay between requests
 *  - exponential backoff + retry caps on 429 / 403 / 5xx / timeout
 *  - an honest, identifying User-Agent
 *  - on-disk caching of raw HTML (never fetch the same URL twice unless forced)
 */

export type FetchResult = {
  ok: boolean;
  status: number;
  body: string;
  url: string;
  fromCache: boolean;
  error?: string;
  retryAfterMs?: number;
};

type FetchOptions = {
  /** Re-fetch even if a cached snapshot exists. */
  force?: boolean;
  /** Override the configured delay window for this call. */
  delayMinMs?: number;
  delayMaxMs?: number;
  /** Per-request signal to allow stopping a job mid-flight. */
  signal?: AbortSignal;
  /** Logger hook for the ingestion console. */
  onLog?: (level: "info" | "warn" | "error", msg: string) => void;
};

// --- Global throttle state (module singleton ⇒ effective concurrency 1) -----
let lastRequestAt = 0;
let inFlight: Promise<unknown> = Promise.resolve();

function jitter(min: number, max: number) {
  return Math.floor(min + Math.random() * Math.max(0, max - min));
}

// --- robots.txt (cached) ----------------------------------------------------
let robotsCache: { fetchedAt: number; disallow: string[] } | null = null;

async function getDisallowedPaths(): Promise<string[]> {
  if (!env.ingestion.respectRobots) return [];
  if (robotsCache && Date.now() - robotsCache.fetchedAt < 6 * 60 * 60 * 1000) {
    return robotsCache.disallow;
  }
  const robotsUrl = `https://${env.ingestion.allowedHost}/robots.txt`;
  try {
    const res = await fetch(robotsUrl, {
      headers: { "User-Agent": env.ingestion.userAgent },
    });
    const text = await res.text();
    const disallow: string[] = [];
    let appliesToUs = true; // default: rules under "User-agent: *"
    for (const line of text.split(/\r?\n/)) {
      const l = line.trim();
      if (!l || l.startsWith("#")) continue;
      const [rawKey, ...rest] = l.split(":");
      const key = rawKey.trim().toLowerCase();
      const value = rest.join(":").trim();
      if (key === "user-agent") appliesToUs = value === "*";
      else if (key === "disallow" && appliesToUs && value) disallow.push(value);
    }
    robotsCache = { fetchedAt: Date.now(), disallow };
    return disallow;
  } catch {
    // If robots.txt can't be read, be conservative but don't hard-block;
    // the allow-list + throttle still protect the source.
    robotsCache = { fetchedAt: Date.now(), disallow: [] };
    return [];
  }
}

function isDisallowedByRobots(url: string, disallow: string[]): boolean {
  try {
    const p = new URL(url).pathname;
    return disallow.some((rule) => p.startsWith(rule));
  } catch {
    return false;
  }
}

// --- Cache (raw HTML snapshots on disk) -------------------------------------
function cachePathFor(normalized: string): string {
  const hash = crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 32);
  return path.join(env.storageDir, "cache", `${hash}.html`);
}

export function rawHtmlPathFor(normalized: string): string {
  const hash = crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 32);
  return path.join(env.storageDir, "raw", `${hash}.html`);
}

async function readCache(normalized: string): Promise<string | null> {
  try {
    return await fs.readFile(cachePathFor(normalized), "utf8");
  } catch {
    return null;
  }
}

async function writeCache(normalized: string, body: string): Promise<void> {
  const cp = cachePathFor(normalized);
  await fs.mkdir(path.dirname(cp), { recursive: true });
  await fs.writeFile(cp, body, "utf8");
}

/** Persist a permanent raw HTML snapshot (provenance) and return its path. */
export async function saveRawHtml(url: string, html: string): Promise<string> {
  const normalized = normalizeUrl(url) ?? url;
  const rp = rawHtmlPathFor(normalized);
  await fs.mkdir(path.dirname(rp), { recursive: true });
  await fs.writeFile(rp, html, "utf8");
  return rp;
}

/** Enforce the global inter-request delay, then mark a request as starting. */
async function awaitTurn(delayMin: number, delayMax: number, onLog?: FetchOptions["onLog"]) {
  // Serialize through a single promise chain ⇒ concurrency 1.
  const prev = inFlight;
  let release!: () => void;
  inFlight = new Promise<void>((r) => (release = r));
  await prev;

  const since = Date.now() - lastRequestAt;
  const wait = jitter(delayMin, delayMax);
  if (lastRequestAt > 0 && since < wait) {
    const remaining = wait - since;
    onLog?.("info", `Polite delay: waiting ${(remaining / 1000).toFixed(1)}s before next request`);
    await sleep(remaining);
  } else if (lastRequestAt === 0) {
    onLog?.("info", `First request — applying initial ${(wait / 1000).toFixed(1)}s courtesy delay`);
    await sleep(wait);
  }
  lastRequestAt = Date.now();
  return release;
}

/**
 * Fetch a URL politely. Returns a FetchResult; never throws on network errors
 * (they're returned as { ok:false }). Honors allow-list, robots, throttle,
 * cache, and backoff.
 */
export async function fetchWithPoliteDelay(
  url: string,
  opts: FetchOptions = {},
): Promise<FetchResult> {
  const normalized = normalizeUrl(url);
  if (!normalized) {
    return { ok: false, status: 0, body: "", url, fromCache: false, error: "Invalid URL" };
  }
  if (!isAllowedSource(normalized)) {
    return {
      ok: false,
      status: 0,
      body: "",
      url: normalized,
      fromCache: false,
      error: `Refused: ${normalized} is outside allowed host ${env.ingestion.allowedHost}`,
    };
  }

  // Cache hit (unless forced).
  if (!opts.force) {
    const cached = await readCache(normalized);
    if (cached !== null) {
      opts.onLog?.("info", `Cache hit — skipping network for ${normalized}`);
      return { ok: true, status: 200, body: cached, url: normalized, fromCache: true };
    }
  }

  // robots.txt.
  const disallow = await getDisallowedPaths();
  if (isDisallowedByRobots(normalized, disallow)) {
    return {
      ok: false,
      status: 0,
      body: "",
      url: normalized,
      fromCache: false,
      error: "Blocked by robots.txt — not fetching",
    };
  }

  const delayMin = opts.delayMinMs ?? env.ingestion.delayMinMs;
  const delayMax = opts.delayMaxMs ?? env.ingestion.delayMaxMs;
  const maxRetries = env.ingestion.maxRetries;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (opts.signal?.aborted) {
      return { ok: false, status: 0, body: "", url: normalized, fromCache: false, error: "Aborted" };
    }

    const release = await awaitTurn(delayMin, delayMax, opts.onLog);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      opts.signal?.addEventListener("abort", () => controller.abort(), { once: true });

      const res = await fetch(normalized, {
        headers: {
          "User-Agent": env.ingestion.userAgent,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "id,en;q=0.8",
        },
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timeout);

      // Throttling / blocking signals ⇒ back off and (maybe) retry.
      if (res.status === 429 || res.status === 403 || res.status >= 500) {
        const retryAfterHeader = Number(res.headers.get("retry-after"));
        const backoff = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
          ? retryAfterHeader * 1000
          : env.ingestion.backoffBaseMs * Math.pow(2, attempt) + jitter(0, 4000);
        release();
        if (attempt < maxRetries) {
          opts.onLog?.(
            "warn",
            `HTTP ${res.status} on ${normalized} — backing off ${(backoff / 1000).toFixed(0)}s (attempt ${attempt + 1}/${maxRetries})`,
          );
          await sleep(backoff);
          continue;
        }
        return {
          ok: false,
          status: res.status,
          body: "",
          url: normalized,
          fromCache: false,
          error: `HTTP ${res.status} after ${maxRetries} retries`,
          retryAfterMs: backoff,
        };
      }

      const body = await res.text();
      release();

      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          body,
          url: normalized,
          fromCache: false,
          error: `HTTP ${res.status}`,
        };
      }

      // Abnormal response guard (e.g. interstitial/anti-bot HTML far too small).
      if (body.length < 256) {
        opts.onLog?.("warn", `Abnormally short response (${body.length} bytes) for ${normalized}`);
      }

      await writeCache(normalized, body);
      return { ok: true, status: res.status, body, url: normalized, fromCache: false };
    } catch (err) {
      release();
      const message = err instanceof Error ? err.message : String(err);
      const isAbort = message.toLowerCase().includes("abort");
      const backoff = env.ingestion.backoffBaseMs * Math.pow(2, attempt) + jitter(0, 4000);
      if (!isAbort && attempt < maxRetries) {
        opts.onLog?.("warn", `Network error on ${normalized}: ${message} — backing off ${(backoff / 1000).toFixed(0)}s`);
        await sleep(backoff);
        continue;
      }
      return {
        ok: false,
        status: 0,
        body: "",
        url: normalized,
        fromCache: false,
        error: isAbort ? "Aborted/timeout" : message,
      };
    }
  }

  return { ok: false, status: 0, body: "", url: normalized, fromCache: false, error: "Exhausted retries" };
}

/** Are we currently inside the configured allowed-hours window? */
export function isWithinAllowedHours(now = new Date()): boolean {
  const spec = env.ingestion.allowedHours.trim();
  if (!spec) return true;
  const hour = now.getHours();
  return spec.split(",").some((range) => {
    const [a, b] = range.split("-").map((x) => parseInt(x.trim(), 10));
    if (Number.isNaN(a)) return false;
    if (b === undefined || Number.isNaN(b)) return hour === a;
    return a <= b ? hour >= a && hour <= b : hour >= a || hour <= b;
  });
}
