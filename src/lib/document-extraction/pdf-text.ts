import type { ExtractedDocument } from "./types";

/**
 * PDF text extraction via unpdf (page-aware). If a PDF yields little/no text it
 * is likely scanned → we flag OCR-required and return partial pages. We never
 * add browser automation or paid OCR.
 */
export async function extractPdf(buffer: Uint8Array): Promise<ExtractedDocument> {
  const warnings: string[] = [];
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(buffer);
    const total: number = pdf.numPages ?? 0;

    const pages: ExtractedDocument["pages"] = [];
    // unpdf can extract per-page when mergePages is false.
    const res = await extractText(pdf, { mergePages: false });
    const perPage: string[] = Array.isArray(res.text) ? res.text : [String(res.text ?? "")];

    perPage.forEach((text, i) => {
      const clean = (text ?? "").trim();
      pages.push({
        pageNumber: i + 1,
        text: clean,
        confidence: clean.length > 40 ? 0.9 : 0.3,
      });
    });

    const totalChars = pages.reduce((n, p) => n + p.text.length, 0);
    const sourceType = totalChars < 50 ? "pdf_ocr" : "pdf_text";
    if (totalChars < 50) {
      warnings.push("PDF produced little or no extractable text — likely scanned. OCR required for full extraction.");
    }

    return {
      sourceType,
      title: null,
      pages: pages.length ? pages : [{ pageNumber: 1, text: "", confidence: 0 }],
      metadata: { numPages: total },
      warnings,
    };
  } catch (err) {
    return {
      sourceType: "pdf_text",
      title: null,
      pages: [],
      metadata: {},
      warnings: [`PDF extraction failed: ${err instanceof Error ? err.message : String(err)}`],
    };
  }
}
