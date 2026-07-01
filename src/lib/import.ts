import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import * as cheerio from "cheerio";
import { env } from "./env";
import { parseDecisionPage } from "./parse";
import { upsertCaseDecision } from "./ingest";
import { indexCaseDecision } from "./search";
import { saveRawHtml } from "./fetcher";
import { normalizeUrl, isAllowedSource } from "./normalize-url";
import { prisma } from "./db";

/**
 * OFFLINE IMPORT — shared logic for ingesting decision files the user saved from
 * their OWN browser (the live site blocks automated fetching with 403). Zero
 * network. Reuses the exact same parser / upsert / index pipeline as live
 * ingestion. Used by both the CLI (scripts/import-files.ts) and the UI route
 * (/api/ingestion/import).
 */

export type ImportOutcome = "imported" | "skipped" | "failed";
export type ImportResult = {
  outcome: ImportOutcome;
  filename: string;
  nomorPutusan?: string | null;
  extractionStatus?: string;
  caseId?: string;
  sourceUrl?: string;
  error?: string;
};

const ALLOWED = env.ingestion.allowedHost;

/** Recover the original decision URL from a saved HTML page (provenance). */
export function canonicalUrlFromHtml(html: string, fallbackName: string): string {
  const $ = cheerio.load(html);
  const candidates = [
    $('link[rel="canonical"]').attr("href"),
    $('meta[property="og:url"]').attr("content"),
    $('meta[name="twitter:url"]').attr("content"),
    (html.match(/saved from url=\(\d+\)(\S+)/) || [])[1],
  ];
  for (const c of candidates) {
    if (!c) continue;
    const n = normalizeUrl(c);
    if (n && isAllowedSource(n)) return n;
  }
  return `https://${ALLOWED}/local-import/${safeName(fallbackName)}`;
}

function safeName(name: string): string {
  return path.basename(name).replace(/[^\w.-]+/g, "_");
}

async function exists(sourceUrl: string): Promise<boolean> {
  const row = await prisma.caseDecision.findUnique({ where: { sourceUrl }, select: { id: true } });
  return !!row;
}

/** Import one saved HTML decision page. */
export async function importHtml(
  filename: string,
  html: string,
  opts: { force?: boolean } = {},
): Promise<ImportResult> {
  try {
    const sourceUrl = canonicalUrlFromHtml(html, filename);
    if (!opts.force && (await exists(sourceUrl))) {
      return { outcome: "skipped", filename, sourceUrl };
    }
    const parsed = parseDecisionPage(html, sourceUrl);
    if (!parsed.nomorPutusan && !parsed.fullText) {
      return { outcome: "failed", filename, error: "Not recognizable as a decision page" };
    }
    const rawPath = await saveRawHtml(sourceUrl, html);
    const caseId = await upsertCaseDecision(parsed, sourceUrl, rawPath);
    await indexCaseDecision(caseId);
    return {
      outcome: "imported",
      filename,
      nomorPutusan: parsed.nomorPutusan,
      extractionStatus: parsed.extractionStatus,
      caseId,
      sourceUrl,
    };
  } catch (err) {
    return { outcome: "failed", filename, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Best-effort nomor-putusan guess from raw decision text (for PDFs). */
function guessNomorFromText(text: string): string | null {
  // Prefer the canonical putusan-number shape, which ends at a 4-digit year.
  const canonical = text.match(/\b\d+\s*[A-Za-z]{0,6}\/[\w.\-]+(?:\/[\w.\-]+)*\/(?:19|20)\d{2}\b/);
  if (canonical) return canonical[0].replace(/\s+/g, " ").trim();
  // Fall back to a value right after "Nomor", but stop at the first year.
  const labelled = text.match(/Nomor\s*[:.]?\s*([0-9][0-9A-Za-z/.\- ]*?(?:19|20)\d{2})\b/i);
  if (labelled) return labelled[1].replace(/\s+/g, " ").trim();
  return null;
}

/** Import one decision PDF: store it locally, extract text, index. */
export async function importPdf(
  filename: string,
  buffer: Uint8Array,
  opts: { force?: boolean; sourceUrl?: string } = {},
): Promise<ImportResult> {
  try {
    // Reject anything that isn't actually a PDF (magic bytes "%PDF").
    if (buffer.length < 5 || buffer[0] !== 0x25 || buffer[1] !== 0x50 || buffer[2] !== 0x44 || buffer[3] !== 0x46) {
      return { outcome: "failed", filename, error: "Not a valid PDF file" };
    }

    const sourceUrl = opts.sourceUrl
      ? normalizeUrl(opts.sourceUrl) ?? `https://${ALLOWED}/local-import/${safeName(filename)}`
      : `https://${ALLOWED}/local-import/${safeName(filename)}`;

    if (!opts.force && (await exists(sourceUrl))) {
      return { outcome: "skipped", filename, sourceUrl };
    }

    // Persist the PDF locally (provenance) regardless of extraction success.
    const hash = crypto.createHash("sha256").update(sourceUrl).digest("hex").slice(0, 32);
    const pdfPath = path.join(env.storageDir, "pdf", `${hash}.pdf`);
    await fs.mkdir(path.dirname(pdfPath), { recursive: true });
    await fs.writeFile(pdfPath, buffer);

    // Extract text (best-effort; failure still preserves the PDF + link).
    let text = "";
    try {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(buffer);
      const res = await extractText(pdf, { mergePages: true });
      text = Array.isArray(res.text) ? res.text.join("\n") : res.text;
    } catch {
      text = "";
    }

    // Reuse the HTML parser by wrapping the extracted text (+ a guessed nomor
    // heading) so all heuristics (amar, year, parties) run identically.
    const nomor = text ? guessNomorFromText(text) : null;
    const synthetic = `<html><head><title>${nomor ? `Putusan Nomor ${nomor}` : "Putusan"}</title></head><body>${
      nomor ? `<h1>Putusan Nomor ${nomor}</h1>` : ""
    }<div class="content">${escapeHtml(text)}</div></body></html>`;

    const parsed = parseDecisionPage(synthetic, sourceUrl);
    // Always mark the PDF as present + linked locally.
    parsed.pdfUrl = parsed.pdfUrl ?? null;
    const caseId = await upsertCaseDecision(parsed, sourceUrl, null);
    await prisma.caseDecision.update({
      where: { id: caseId },
      data: { localPdfPath: pdfPath, hasPdf: true },
    });
    await indexCaseDecision(caseId);

    return {
      outcome: "imported",
      filename,
      nomorPutusan: parsed.nomorPutusan,
      extractionStatus: text ? parsed.extractionStatus : "partial",
      caseId,
      sourceUrl,
    };
  } catch (err) {
    return { outcome: "failed", filename, error: err instanceof Error ? err.message : String(err) };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
