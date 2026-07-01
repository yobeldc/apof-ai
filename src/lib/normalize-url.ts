import { env } from "./env";

/**
 * Tracking/session params that must not create duplicate URLs. Removed during
 * normalization so the same decision is never queued twice.
 */
const STRIP_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "ref",
  "sessionid",
  "phpsessid",
  "_ga",
]);

/**
 * Normalize a URL into a canonical form for deduplication.
 *  - lowercases scheme + host
 *  - forces https
 *  - drops default ports, fragments, tracking params
 *  - sorts remaining query params
 *  - removes a trailing slash (except root)
 * Returns null for input that is not a parseable absolute http(s) URL.
 */
export function normalizeUrl(input: string): string | null {
  if (!input) return null;
  let raw = input.trim();
  if (!raw) return null;
  // Add scheme if a bare host/path was given.
  if (!/^https?:\/\//i.test(raw)) {
    if (/^[\w.-]+\.[a-z]{2,}/i.test(raw)) raw = "https://" + raw;
    else return null;
  }

  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") return null;

  u.protocol = "https:";
  u.hostname = u.hostname.toLowerCase();
  u.hash = "";
  if (
    (u.protocol === "https:" && u.port === "443") ||
    (u.protocol === "http:" && u.port === "80")
  ) {
    u.port = "";
  }

  // Filter + sort query params.
  const params = new URLSearchParams(u.search);
  const kept: [string, string][] = [];
  for (const [k, v] of params.entries()) {
    if (STRIP_PARAMS.has(k.toLowerCase())) continue;
    kept.push([k, v]);
  }
  kept.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  u.search = kept.length ? "?" + kept.map(([k, v]) => `${k}=${v}`).join("&") : "";

  // Drop trailing slash (but keep root "/").
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.replace(/\/+$/, "");
  }

  return u.toString();
}

/** Is this URL on the single allowed source host? Subdomains allowed. */
export function isAllowedSource(input: string): boolean {
  const normalized = normalizeUrl(input);
  if (!normalized) return false;
  try {
    const host = new URL(normalized).hostname;
    const allowed = env.ingestion.allowedHost.toLowerCase();
    return host === allowed || host.endsWith("." + allowed) || allowed.endsWith("." + host);
  } catch {
    return false;
  }
}

/**
 * Heuristic: does this look like a decision *detail* page (vs a listing/search
 * page)? putusan3 detail pages live under /direktori/putusan/<slug>.
 */
export function looksLikeDetailUrl(input: string): boolean {
  const n = normalizeUrl(input);
  if (!n) return false;
  return /\/direktori\/putusan\/[^/]+/.test(n) || /\/putusan\/[0-9a-f]{8,}/i.test(n);
}
