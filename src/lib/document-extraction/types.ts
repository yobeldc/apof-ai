/** Page-aware extraction output — documents are never an anonymous blob. */
export type ExtractedDocument = {
  sourceType: "html" | "pdf_text" | "pdf_ocr" | "plain_text";
  title?: string | null;
  pages: Array<{
    pageNumber: number;
    text: string;
    confidence?: number | null;
  }>;
  metadata: Record<string, unknown>;
  warnings: string[];
};

export const EMPTY_EXTRACTION = (sourceType: ExtractedDocument["sourceType"], warning: string): ExtractedDocument => ({
  sourceType,
  title: null,
  pages: [],
  metadata: {},
  warnings: [warning],
});
