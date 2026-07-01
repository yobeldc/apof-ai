/**
 * One-off polite reconnaissance: fetch a listing URL through the SAME polite
 * fetcher the app uses (honest UA, robots-aware, backoff) and report what we
 * see — WITHOUT committing anything. Used to confirm the site accepts our
 * user-agent and to learn the 2026 listing/pagination URL structure before any
 * real ingestion.
 *
 *   npm run recon -- "<url>"
 *
 * If this returns 403/blocked, we DO NOT proceed — that is an access control we
 * must respect, not bypass.
 */
import { fetchWithPoliteDelay } from "../src/lib/fetcher";
import { extractDetailLinks, extractNextPage } from "../src/lib/discover";
import { isAllowedSource } from "../src/lib/normalize-url";

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: npm run recon -- "<url>"');
    process.exit(1);
  }
  if (!isAllowedSource(url)) {
    console.error(`Refused: ${url} is not on the allowed source host.`);
    process.exit(1);
  }

  console.log(`\nReconnaissance fetch (polite) → ${url}\n`);
  // Use a short delay for a single manual recon request.
  const res = await fetchWithPoliteDelay(url, {
    force: true,
    delayMinMs: 2000,
    delayMaxMs: 4000,
    onLog: (lvl, m) => console.log(`  [${lvl}] ${m}`),
  });

  console.log(`\n  HTTP status : ${res.status}`);
  console.log(`  ok          : ${res.ok}`);
  console.log(`  from cache  : ${res.fromCache}`);
  console.log(`  body length : ${res.body.length}`);
  if (res.error) console.log(`  error       : ${res.error}`);

  if (res.ok && res.body) {
    const links = extractDetailLinks(res.body, url);
    const next = extractNextPage(res.body, url);
    // Look for a result-count phrase like "Ditemukan X data".
    const countMatch = res.body.match(/Ditemukan\s+([\d.,]+)\s+data/i);
    console.log(`\n  Detail links found on this page : ${links.length}`);
    links.slice(0, 5).forEach((l) => console.log(`    - ${l}`));
    console.log(`  Next-page link                  : ${next ?? "(none found)"}`);
    console.log(`  Result-count phrase             : ${countMatch ? countMatch[0] : "(not found)"}`);
    // Show a tiny snippet to eyeball anti-bot/interstitial pages.
    const text = res.body.replace(/\s+/g, " ").slice(0, 240);
    console.log(`\n  First 240 chars: ${text}\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
