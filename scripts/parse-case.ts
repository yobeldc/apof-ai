/**
 * CLI: fetch + parse a single decision URL and print the structured result.
 * Useful for debugging the parser. Goes through the polite fetcher (cached).
 *
 *   npm run ingest:parse -- "<decisionUrl>"
 */
import { fetchWithPoliteDelay } from "../src/lib/fetcher";
import { parseDecisionPage } from "../src/lib/parse";
import { isAllowedSource } from "../src/lib/normalize-url";

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: npm run ingest:parse -- "<decisionUrl>"');
    process.exit(1);
  }
  if (!isAllowedSource(url)) {
    console.error(`Refused: ${url} is not on the allowed source host.`);
    process.exit(1);
  }

  console.log(`Fetching ${url} …`);
  const res = await fetchWithPoliteDelay(url, { onLog: (l, m) => console.log(`[${l}] ${m}`) });
  if (!res.ok) {
    console.error(`Fetch failed: ${res.error ?? res.status}`);
    process.exit(1);
  }

  const parsed = parseDecisionPage(res.body, url);
  console.log(JSON.stringify(parsed, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
