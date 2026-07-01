import { describe, it, expect } from "vitest";
import { extractHtml } from "@/lib/document-extraction/html-text";
import { extractPlainText } from "@/lib/document-extraction/plain-text";
import { getOcrProvider } from "@/lib/document-extraction/ocr";

describe("HTML extraction", () => {
  it("produces at least one page-like record + title", () => {
    const r = extractHtml("<html><head><title>Putusan 123</title></head><body><div>Mengadili menolak kasasi.</div></body></html>");
    expect(r.sourceType).toBe("html");
    expect(r.pages).toHaveLength(1);
    expect(r.pages[0].pageNumber).toBe(1);
    expect(r.pages[0].text).toContain("Mengadili");
    expect(r.title).toBe("Putusan 123");
  });

  it("warns on near-empty HTML", () => {
    const r = extractHtml("<html><body></body></html>");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("plain text extraction", () => {
  it("splits on form-feed into pages", () => {
    const r = extractPlainText("halaman satu\fhalaman dua");
    expect(r.pages).toHaveLength(2);
    expect(r.pages[1].pageNumber).toBe(2);
  });
  it("single page when no form-feed", () => {
    const r = extractPlainText("teks satu halaman");
    expect(r.pages).toHaveLength(1);
  });
});

describe("OCR provider (optional, off by default)", () => {
  it("returns a clear warning when unconfigured (no crash)", async () => {
    const ocr = getOcrProvider();
    expect(ocr.name).toBe("none");
    const r = await ocr.ocr(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    expect(r.pages).toHaveLength(0);
    expect(r.warnings.join(" ")).toMatch(/OCR is not configured/i);
  });
});
