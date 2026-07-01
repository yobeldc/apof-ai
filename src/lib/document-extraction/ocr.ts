import { env } from "../env";
import type { ExtractedDocument } from "./types";

/**
 * OCR provider interface — OPTIONAL and OFF by default. We deliberately do NOT
 * bundle a paid OCR API or browser automation. A self-hosted OCR HTTP endpoint
 * (e.g. local Tesseract/PaddleOCR server) can be wired via RAG_* config later.
 * If unconfigured, OCR returns a clear warning rather than failing.
 */
export interface OcrProvider {
  name: string;
  ocr(buffer: Uint8Array): Promise<ExtractedDocument>;
}

export const noopOcrProvider: OcrProvider = {
  name: "none",
  async ocr(): Promise<ExtractedDocument> {
    return {
      sourceType: "pdf_ocr",
      title: null,
      pages: [],
      metadata: {},
      warnings: [
        "OCR is not configured. This document appears to be scanned and needs OCR for full text. " +
          "Configure a self-hosted OCR endpoint to enable it (no paid API is used by default).",
      ],
    };
  },
};

/**
 * Self-hosted OCR over HTTP (e.g. a local Tesseract/PaddleOCR server). POSTs the
 * raw PDF bytes; expects `{ pages: [{ pageNumber, text, confidence? }] }` or a
 * flat `{ text }`. No paid API, no browser automation. Fails gracefully.
 */
class HttpOcrProvider implements OcrProvider {
  name = "custom_http";
  private url = env.rag.ocrHttpUrl;
  async ocr(buffer: Uint8Array): Promise<ExtractedDocument> {
    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers: { "content-type": "application/pdf" },
        // Uint8Array is a valid fetch body at runtime; cast around TS lib ArrayBuffer friction.
        body: buffer as unknown as BodyInit,
      });
      if (!res.ok) throw new Error(`OCR HTTP ${res.status}`);
      const data = await res.json();
      const pages: ExtractedDocument["pages"] = Array.isArray(data.pages)
        ? data.pages.map((p: { pageNumber?: number; text?: string; confidence?: number }, i: number) => ({
            pageNumber: p.pageNumber ?? i + 1,
            text: String(p.text ?? "").trim(),
            confidence: p.confidence ?? 0.6,
          }))
        : [{ pageNumber: 1, text: String(data.text ?? "").trim(), confidence: 0.6 }];
      return {
        sourceType: "pdf_ocr",
        title: null,
        pages: pages.filter((p) => p.text.length > 0),
        metadata: { ocr: "custom_http" },
        warnings: pages.some((p) => p.text.length > 0) ? [] : ["OCR returned no text."],
      };
    } catch (err) {
      return {
        sourceType: "pdf_ocr",
        title: null,
        pages: [],
        metadata: {},
        warnings: [`OCR endpoint failed: ${err instanceof Error ? err.message : String(err)}`],
      };
    }
  }
}

export function getOcrProvider(): OcrProvider {
  return env.rag.ocrHttpUrl ? new HttpOcrProvider() : noopOcrProvider;
}
