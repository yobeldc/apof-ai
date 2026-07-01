import type { RetrievedEvidence } from "./retrieve";

/**
 * Hallucination control. Checks that citations reference real evidence and that
 * quotes approximately appear in the cited chunk. Drops unsupported citations
 * and downgrades confidence rather than presenting unverified claims as certain.
 */

export type RawCitation = { sourceId: string; quote?: string };

export type VerifiedCitation = {
  sourceId: string;
  chunkId: string;
  caseDecisionId: string;
  quote: string;
  pageStart?: number | null;
  pageEnd?: number | null;
  sectionTitle?: string | null;
  sectionKind?: string | null;
};

export type VerificationOutput = {
  citations: VerifiedCitation[];
  confidence: "high" | "medium" | "low";
  limitations: string[];
  unsupportedCount: number;
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9 ]/g, "").trim();
}

/** Approximate containment: most of the quote's words appear in the chunk. */
export function quoteSupported(quote: string, chunkText: string): boolean {
  const q = normalize(quote);
  if (q.length < 8) return false;
  const chunk = normalize(chunkText);
  if (chunk.includes(q)) return true;
  // Token-overlap fallback for paraphrased whitespace/punctuation.
  const qTokens = q.split(" ").filter((t) => t.length > 2);
  if (qTokens.length === 0) return false;
  const present = qTokens.filter((t) => chunk.includes(t)).length;
  return present / qTokens.length >= 0.7;
}

export function verifyCitations(
  rawCitations: RawCitation[],
  evidence: RetrievedEvidence[],
  proposedConfidence: "high" | "medium" | "low",
): VerificationOutput {
  const byId = new Map(evidence.map((e) => [e.sourceId, e]));
  const verified: VerifiedCitation[] = [];
  const limitations: string[] = [];
  let unsupported = 0;

  for (const c of rawCitations) {
    const ev = byId.get(c.sourceId);
    if (!ev) {
      unsupported++;
      continue; // citation references non-existent evidence — drop it
    }
    const quote = c.quote?.trim() || ev.text.slice(0, 200);
    if (c.quote && !quoteSupported(c.quote, ev.text)) {
      unsupported++;
      // keep the citation but replace the unverified quote with a real excerpt
      verified.push(toVerified(ev, ev.text.slice(0, 200)));
      continue;
    }
    verified.push(toVerified(ev, quote));
  }

  let confidence = proposedConfidence;
  if (verified.length === 0) {
    confidence = "low";
    limitations.push("Tidak ada kutipan yang dapat diverifikasi dari dokumen.");
  } else if (unsupported > 0) {
    if (confidence === "high") confidence = "medium";
    limitations.push(`${unsupported} klaim tidak didukung evidence dan telah dihapus/diperbaiki.`);
  }
  if (evidence.length < 2 && confidence === "high") confidence = "medium";

  return { citations: verified, confidence, limitations, unsupportedCount: unsupported };
}

function toVerified(ev: RetrievedEvidence, quote: string): VerifiedCitation {
  return {
    sourceId: ev.sourceId,
    chunkId: ev.chunkId,
    caseDecisionId: ev.caseDecisionId,
    quote,
    pageStart: ev.pageStart,
    pageEnd: ev.pageEnd,
    sectionTitle: ev.sectionTitle,
    sectionKind: ev.sectionKind,
  };
}
