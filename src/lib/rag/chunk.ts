import crypto from "node:crypto";
import type { NormalizedLegalDocument } from "../legal/types";
import { extractCitedArticles } from "../legal/normalize";

/**
 * Legal-aware chunking. Sections are the primary unit; long sections are split
 * into overlapping windows. Short sections are kept whole (heading + body).
 * Deterministic chunk IDs (content+position hash) so re-indexing is idempotent.
 */

export type LegalChunk = {
  id: string;
  caseDecisionId: string;
  chunkIndex: number;
  parentSection?: string | null;
  sectionTitle?: string | null;
  sectionKind?: string | null;
  pageStart?: number | null;
  pageEnd?: number | null;
  paragraphStart?: number | null;
  paragraphEnd?: number | null;
  text: string;
  normalizedText: string;
  legalTerms: string[];
  citedArticles: string[];
  partiesMentioned: string[];
  judgesMentioned: string[];
  createdAt?: Date;
};

export type ChunkOptions = {
  targetChars?: number; // ~3000–5000
  overlapChars?: number; // ~500–800
  minChunkChars?: number; // don't split below this
};

const LEGAL_TERMS = [
  "kasasi", "peninjauan kembali", "banding", "eksepsi", "wanprestasi",
  "perbuatan melawan hukum", "amar", "pertimbangan hukum", "putusan sela",
  "dakwaan", "tuntutan", "gugatan", "permohonan", "yurisprudensi", "ratio decidendi",
];

function deterministicId(caseId: string, index: number, text: string): string {
  const h = crypto.createHash("sha256").update(`${caseId}::${index}::${text}`).digest("hex").slice(0, 24);
  return `chk_${h}`;
}

function normalizeForIndex(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function findLegalTerms(textLower: string): string[] {
  return LEGAL_TERMS.filter((t) => textLower.includes(t));
}

/** Split a single long string into overlapping windows on paragraph/sentence edges. */
function splitWithOverlap(text: string, target: number, overlap: number): string[] {
  if (text.length <= target) return [text];
  const out: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + target, text.length);
    if (end < text.length) {
      // Prefer to break at a paragraph, then sentence, then space near `end`.
      const window = text.slice(start, end);
      const para = window.lastIndexOf("\n\n");
      const sentence = window.lastIndexOf(". ");
      const space = window.lastIndexOf(" ");
      const breakAt = para > target * 0.5 ? para : sentence > target * 0.5 ? sentence + 1 : space > target * 0.5 ? space : window.length;
      end = start + breakAt;
    }
    const piece = text.slice(start, end).trim();
    if (piece) out.push(piece);
    if (end >= text.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return out;
}

export function chunkDocument(doc: NormalizedLegalDocument, opts: ChunkOptions = {}): LegalChunk[] {
  const target = opts.targetChars ?? 4000;
  const overlap = opts.overlapChars ?? 600;
  const minChunk = opts.minChunkChars ?? 1200;

  const chunks: LegalChunk[] = [];
  let index = 0;

  const sections = doc.sections.length
    ? doc.sections
    : [{ kind: "unknown" as const, title: null, start: 0, end: doc.cleanedText.length, text: doc.cleanedText, pageStart: null, pageEnd: null, confidence: 0.2 }];

  for (const section of sections) {
    const body = section.text.trim();
    if (!body) continue; // never emit empty chunks

    // Short section → keep whole (heading stays attached to its body).
    const pieces = body.length <= Math.max(target, minChunk) ? [body] : splitWithOverlap(body, target, overlap);

    for (const piece of pieces) {
      const text = piece.trim();
      if (!text) continue;
      const lower = normalizeForIndex(text);
      const partiesMentioned = doc.parties.filter((p) => p && lower.includes(p.toLowerCase().slice(0, 24)));
      const judgesMentioned = doc.judges.filter((j) => j && lower.includes(j.toLowerCase().slice(0, 24)));
      chunks.push({
        id: deterministicId(doc.caseDecisionId, index, text),
        caseDecisionId: doc.caseDecisionId,
        chunkIndex: index,
        parentSection: section.kind,
        sectionTitle: section.title,
        sectionKind: section.kind,
        pageStart: section.pageStart,
        pageEnd: section.pageEnd,
        paragraphStart: null,
        paragraphEnd: null,
        text,
        normalizedText: lower,
        legalTerms: findLegalTerms(lower),
        citedArticles: extractCitedArticles(text),
        partiesMentioned,
        judgesMentioned,
      });
      index++;
    }
  }

  return chunks;
}
