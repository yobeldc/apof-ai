import type { ExtractedDocument } from "./types";

/**
 * Plain-text extraction. Splits on form-feed (\f) into pages when present,
 * otherwise one page. Useful for already-extracted text or .txt imports.
 */
export function extractPlainText(text: string): ExtractedDocument {
  const parts = text.includes("\f") ? text.split("\f") : [text];
  const pages = parts
    .map((t, i) => ({ pageNumber: i + 1, text: t.trim(), confidence: 1 }))
    .filter((p) => p.text.length > 0);
  return {
    sourceType: "plain_text",
    title: null,
    pages: pages.length ? pages : [{ pageNumber: 1, text: text.trim(), confidence: 1 }],
    metadata: {},
    warnings: text.trim().length < 40 ? ["Plain text is very short."] : [],
  };
}
