import type { LegalSection, LegalSectionKind } from "./types";

/**
 * Deterministic Indonesian legal-section detection. Each detector is a heading/
 * phrase pattern mapped to a LegalSectionKind. We split the document at detected
 * markers; text before the first marker and between markers becomes a section.
 * No LLM, no invention — undetected spans are "unknown".
 */

type Marker = {
  kind: LegalSectionKind;
  title: string;
  // Case-insensitive; anchored to start-of-line-ish positions where possible.
  pattern: RegExp;
  confidence: number;
};

// Order matters only for title preference on overlap; matching is global.
const MARKERS: Marker[] = [
  { kind: "case_identity", title: "Kepala Putusan", pattern: /Demi\s+Keadilan\s+Berdasarkan\s+Ketuhanan\s+Yang\s+Maha\s+Esa/gi, confidence: 1 },
  { kind: "case_identity", title: "Nomor Putusan", pattern: /\bP\s*U\s*T\s*U\s*S\s*A\s*N\b/g, confidence: 0.8 },
  { kind: "procedural_history", title: "Duduk Perkara", pattern: /\bTentang\s+Duduk(?:nya)?\s+Perkara\b/gi, confidence: 0.9 },
  { kind: "parties", title: "Para Pihak", pattern: /\b(?:Pemohon|Termohon|Penggugat|Tergugat|Terdakwa|Penuntut\s+Umum)\b/gi, confidence: 0.6 },
  { kind: "legal_issues", title: "Dalam Eksepsi", pattern: /\bDalam\s+Eksepsi\b/gi, confidence: 0.85 },
  { kind: "facts", title: "Dalam Pokok Perkara", pattern: /\bDalam\s+Pokok\s+Perkara\b/gi, confidence: 0.85 },
  { kind: "court_reasoning", title: "Pertimbangan Hukum", pattern: /\bPertimbangan\s+Hukum\b/gi, confidence: 0.95 },
  { kind: "court_reasoning", title: "Menimbang", pattern: /\bMenimbang\b/g, confidence: 0.8 },
  { kind: "legal_basis", title: "Mengingat", pattern: /\bMengingat\b/g, confidence: 0.85 },
  { kind: "legal_basis", title: "Memperhatikan", pattern: /\bMemperhatikan\b/g, confidence: 0.8 },
  { kind: "final_ruling", title: "Mengadili", pattern: /\bM\s*E\s*N\s*G\s*A\s*D\s*I\s*L\s*I\b/gi, confidence: 1 },
  { kind: "final_ruling", title: "Amar Putusan", pattern: /\bAmar\s+Putusan\b/gi, confidence: 0.95 },
];

const RULING_VERBS = /\b(Menyatakan|Menolak|Mengabulkan|Menghukum|Membebankan|Membatalkan|Menguatkan)\b/gi;

/** A detected raw marker position in the text. */
type Hit = { kind: LegalSectionKind; title: string; index: number; confidence: number };

export function detectSectionMarkers(text: string): Hit[] {
  const hits: Hit[] = [];
  for (const m of MARKERS) {
    m.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = m.pattern.exec(text)) !== null) {
      hits.push({ kind: m.kind, title: m.title, index: match.index, confidence: m.confidence });
      if (match.index === m.pattern.lastIndex) m.pattern.lastIndex++; // avoid zero-width loop
    }
  }
  // Sort by position; keep the highest-confidence marker when several coincide.
  hits.sort((a, b) => a.index - b.index || b.confidence - a.confidence);
  // Collapse near-duplicate markers within a small window (e.g. 8 chars).
  const collapsed: Hit[] = [];
  for (const h of hits) {
    const prev = collapsed[collapsed.length - 1];
    if (prev && Math.abs(h.index - prev.index) < 8) continue;
    collapsed.push(h);
  }
  return collapsed;
}

/**
 * Split cleaned text into legal sections using detected markers. Text before the
 * first marker is "case_identity" (the header block). Each marker starts a new
 * section running until the next marker.
 */
export function detectSections(
  cleanedText: string,
  pageBoundaries?: { pageNumber: number; start: number }[],
): LegalSection[] {
  const text = cleanedText;
  if (!text.trim()) return [];

  const hits = detectSectionMarkers(text);
  const sections: LegalSection[] = [];

  const pageForOffset = (offset: number): number | null => {
    if (!pageBoundaries?.length) return null;
    let page = pageBoundaries[0].pageNumber;
    for (const b of pageBoundaries) {
      if (b.start <= offset) page = b.pageNumber;
      else break;
    }
    return page;
  };

  const pushSection = (kind: LegalSectionKind, title: string | null, start: number, end: number, confidence: number) => {
    const slice = text.slice(start, end).trim();
    if (!slice) return;
    sections.push({
      kind,
      title,
      start,
      end,
      text: slice,
      pageStart: pageForOffset(start),
      pageEnd: pageForOffset(Math.max(start, end - 1)),
      confidence,
    });
  };

  if (hits.length === 0) {
    pushSection("unknown", null, 0, text.length, 0.2);
    return sections;
  }

  // Header block before the first marker.
  if (hits[0].index > 0) {
    pushSection("case_identity", "Kepala Putusan", 0, hits[0].index, 0.5);
  }

  for (let i = 0; i < hits.length; i++) {
    const h = hits[i];
    const end = i + 1 < hits.length ? hits[i + 1].index : text.length;
    let kind = h.kind;
    // Promote a "Menimbang" block that contains ruling verbs near the end.
    if (kind === "court_reasoning" && RULING_VERBS.test(text.slice(h.index, end))) {
      RULING_VERBS.lastIndex = 0;
    }
    pushSection(kind, h.title, h.index, end, h.confidence);
  }

  return sections;
}

/** Best-effort: pick the single section text for a given kind (first match). */
export function sectionTextOfKind(sections: LegalSection[], kind: LegalSectionKind): string | null {
  const s = sections.find((x) => x.kind === kind);
  return s ? s.text : null;
}
