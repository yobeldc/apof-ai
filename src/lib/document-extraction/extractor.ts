import { promises as fs } from "node:fs";
import type { ExtractedDocument } from "./types";
import { extractPdf } from "./pdf-text";
import { extractHtml } from "./html-text";
import { extractPlainText } from "./plain-text";
import { getOcrProvider } from "./ocr";

/**
 * Unified extraction entry. Picks the right provider by input kind and returns a
 * page-aware ExtractedDocument. OCR is attempted only when a PDF looks scanned
 * AND an OCR provider is configured (default: none → warning).
 */

export async function extractFromHtml(html: string): Promise<ExtractedDocument> {
  return extractHtml(html);
}

export async function extractFromPlainText(text: string): Promise<ExtractedDocument> {
  return extractPlainText(text);
}

export async function extractFromPdfBuffer(buffer: Uint8Array): Promise<ExtractedDocument> {
  const result = await extractPdf(buffer);
  if (result.sourceType === "pdf_ocr") {
    const ocr = getOcrProvider();
    if (ocr.name !== "none") {
      const ocrResult = await ocr.ocr(buffer);
      if (ocrResult.pages.length) return ocrResult;
    }
    // Keep the partial result + its OCR-required warning.
  }
  return result;
}

/** Extract from a stored raw HTML snapshot path, if available. */
export async function extractFromRawHtmlPath(path: string): Promise<ExtractedDocument | null> {
  try {
    const html = await fs.readFile(path, "utf8");
    return extractHtml(html);
  } catch {
    return null;
  }
}

/** Extract from a stored local PDF path, if available. */
export async function extractFromPdfPath(path: string): Promise<ExtractedDocument | null> {
  try {
    const buf = await fs.readFile(path);
    return extractFromPdfBuffer(new Uint8Array(buf));
  } catch {
    return null;
  }
}
