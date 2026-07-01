import * as cheerio from "cheerio";
import type { ExtractedDocument } from "./types";

/**
 * HTML extraction via Cheerio. HTML has no native page boundaries, so we emit a
 * single page-like record (pageNumber 1). Title is recovered when present.
 */
export function extractHtml(html: string): ExtractedDocument {
  const warnings: string[] = [];
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();

  const title = $("title").first().text().trim() || $("h1").first().text().trim() || null;
  const body =
    $("#popup-detail, .putusan-detail, .content, #content, article, main").first().text() ||
    $("body").text();
  const text = body.replace(/\s+\n/g, "\n").replace(/[ \t]+/g, " ").trim();

  if (text.length < 40) warnings.push("HTML produced very little text.");

  return {
    sourceType: "html",
    title,
    pages: [{ pageNumber: 1, text, confidence: text.length > 40 ? 0.85 : 0.3 }],
    metadata: { title },
    warnings,
  };
}
