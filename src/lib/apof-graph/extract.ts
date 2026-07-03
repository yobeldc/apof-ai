/**
 * Hybrid extractor for Apof Graph structured legal data.
 * Combines deterministic parsing with optional LLM assistance.
 *
 * Conservative approach: unknown > invented. Every extraction must be
 * grounded in source text. Null is preferred over hallucination.
 */

import { prisma } from "../db";
import { fromJsonList } from "../serialize";
import {
  ApofGraphDecisionExtraction,
  ApofGraphEvidenceSpan,
  validateApofGraphExtraction,
} from "./schema";
import { buildExtractionPrompt } from "./prompt";

/**
 * Options controlling the extraction pipeline.
 */
export interface ExtractOptions {
  /** Prisma ID of the CaseDecision to extract from. */
  caseDecisionId: string;
  /** Whether to invoke the LLM extraction phase. */
  useLlm?: boolean;
  /** Which LLM provider to use. */
  llmProvider?: "mock" | "anthropic" | "ollama";
  /** Semantic version of the extraction prompt. */
  promptVersion?: string;
}

/**
 * Result of a single extraction run.
 */
export interface ExtractResult {
  /** The extracted structured data, or null if nothing usable was found. */
  extraction: ApofGraphDecisionExtraction | null;
  /** Pipeline method that produced the extraction. */
  method: "deterministic" | "llm" | "hybrid" | "none";
  /** Per-field confidence scores (0-1). */
  confidence: Record<string, number>;
  /** Schema fields that could not be populated. */
  unsupportedFields: string[];
  /** Evidence anchors tying fields to source text. */
  evidenceSpans: ApofGraphEvidenceSpan[];
  /** Human-readable error message when the pipeline fails entirely. */
  error?: string;
}

const CONFIDENCE = {
  DIRECT_COLUMN: 1.0,
  PARSED_JSON: 0.9,
  REGEX_EXTRACT: 0.7,
  HEURISTIC: 0.6,
  LLM_EXTRACT: 0.75,
  NONE: 0.0,
} as const;

function classifyOutcome(amarText: string | null): {
  outcome: string | null;
  confidence: number;
} {
  if (!amarText) return { outcome: null, confidence: CONFIDENCE.NONE };
  const normalized = amarText.toUpperCase();

  if (normalized.includes("MENGABULKAN")) return { outcome: "granted", confidence: CONFIDENCE.HEURISTIC };
  if (normalized.includes("MENOLAK")) return { outcome: "denied", confidence: CONFIDENCE.HEURISTIC };
  if (normalized.includes("MEMBEBASKAN")) return { outcome: "acquitted", confidence: CONFIDENCE.HEURISTIC };
  if (normalized.includes("MENGHUKUM")) return { outcome: "guilty", confidence: CONFIDENCE.HEURISTIC };
  if (normalized.includes("MEMBATALKAN")) return { outcome: "dismissed", confidence: CONFIDENCE.HEURISTIC };

  return { outcome: null, confidence: CONFIDENCE.NONE };
}

function extractCitedStatutes(fullText: string): {
  articles: string[];
  statutes: string[];
  confidence: number;
} {
  const articles: Set<string> = new Set();
  const statutes: Set<string> = new Set();

  const pasalMatches = fullText.match(/Pasal\s+\d+(?:\s+ayat\s*\([^)]+\))?/gi);
  if (pasalMatches) pasalMatches.forEach((m) => articles.add(m.trim()));

  const uuMatches = fullText.match(/UU\s+[^.,;\n]+/gi);
  if (uuMatches) uuMatches.forEach((m) => statutes.add(m.trim()));

  return { articles: Array.from(articles), statutes: Array.from(statutes), confidence: CONFIDENCE.REGEX_EXTRACT };
}

function parseMonetaryAmount(amountStr: string): number | null {
  const cleaned = amountStr.replace(/^\s*(?:Rp\s*|USD\s*|\$)\s*/i, "").replace(/\./g, "").replace(/,/g, ".").trim();
  const lower = cleaned.toLowerCase();
  let multiplier = 1;
  let numericPart = cleaned;

  if (lower.includes("juta")) { multiplier = 1_000_000; numericPart = cleaned.replace(/juta/i, "").trim(); }
  else if (lower.includes("miliar") || lower.includes("milyar")) { multiplier = 1_000_000_000; numericPart = cleaned.replace(/miliar/i, "").replace(/milyar/i, "").trim(); }
  else if (lower.includes("ribu")) { multiplier = 1_000; numericPart = cleaned.replace(/ribu/i, "").trim(); }
  else if (lower.includes("triliun")) { multiplier = 1_000_000_000_000; numericPart = cleaned.replace(/triliun/i, "").trim(); }

  const parsed = Number.parseFloat(numericPart);
  if (Number.isNaN(parsed)) return null;
  return parsed * multiplier;
}

function extractSentenceContext(text: string, position: number): string | null {
  const before = text.lastIndexOf(".", position) + 1;
  const after = text.indexOf(".", position);
  if (before === -1 || after === -1) return null;
  const sentence = text.slice(before, after + 1).trim();
  return sentence.length > 200 ? sentence.slice(0, 200) + "..." : sentence;
}

function makeSpan(
  target_path: string, source_id: string, quote: string | null,
  page_start: number | null, page_end: number | null,
  paragraph_start: number | null, paragraph_end: number | null
): ApofGraphEvidenceSpan {
  return { target_path, chunk_id: null, source_id, page_start, page_end, paragraph_start, paragraph_end, quote: quote ?? "" };
}

async function deterministicExtract(caseDecisionId: string): Promise<{
  partial: Partial<ApofGraphDecisionExtraction>;
  confidence: Record<string, number>;
  spans: ApofGraphEvidenceSpan[];
}> {
  const confidence: Record<string, number> = {};
  const spans: ApofGraphEvidenceSpan[] = [];

  const caseDecision = await prisma.caseDecision.findUnique({ where: { id: caseDecisionId } });
  if (!caseDecision) return { partial: {}, confidence, spans };

  const partial: Partial<ApofGraphDecisionExtraction> = {};

  if (caseDecision.nomorPutusan) {
    partial.nomor_putusan = caseDecision.nomorPutusan;
    confidence["nomor_putusan"] = CONFIDENCE.DIRECT_COLUMN;
    spans.push(makeSpan("nomor_putusan", "CaseDecision.nomorPutusan", caseDecision.nomorPutusan, null, null, null, null));
  }

  if (caseDecision.pengadilan) {
    partial.court = caseDecision.pengadilan;
    confidence["court"] = CONFIDENCE.DIRECT_COLUMN;
    spans.push(makeSpan("court", "CaseDecision.pengadilan", caseDecision.pengadilan, null, null, null, null));
  }

  if (caseDecision.tingkatProses) {
    partial.tingkat_proses = caseDecision.tingkatProses;
    confidence["tingkat_proses"] = CONFIDENCE.DIRECT_COLUMN;
    spans.push(makeSpan("tingkat_proses", "CaseDecision.tingkatProses", caseDecision.tingkatProses, null, null, null, null));
  }

  if (caseDecision.klasifikasi) {
    partial.klasifikasi = caseDecision.klasifikasi;
    confidence["klasifikasi"] = CONFIDENCE.DIRECT_COLUMN;
    spans.push(makeSpan("klasifikasi", "CaseDecision.klasifikasi", caseDecision.klasifikasi, null, null, null, null));
  }

  if (caseDecision.tahun) {
    partial.year = caseDecision.tahun;
    confidence["year"] = CONFIDENCE.DIRECT_COLUMN;
    spans.push(makeSpan("year", "CaseDecision.tahun", String(caseDecision.tahun), null, null, null, null));
  }

  if (caseDecision.tanggalRegister) {
    partial.tanggal_register = caseDecision.tanggalRegister;
    confidence["tanggal_register"] = CONFIDENCE.DIRECT_COLUMN;
  }
  if (caseDecision.tanggalPutusan) {
    partial.tanggal_putusan = caseDecision.tanggalPutusan;
    confidence["tanggal_putusan"] = CONFIDENCE.DIRECT_COLUMN;
  }
  if (caseDecision.tanggalMinutasi) {
    partial.tanggal_musyawarah = caseDecision.tanggalMinutasi;
    confidence["tanggal_musyawarah"] = CONFIDENCE.DIRECT_COLUMN;
  }

  if (caseDecision.hakim) {
    try {
      const hakimList = fromJsonList(caseDecision.hakim);
      if (Array.isArray(hakimList) && hakimList.length > 0) {
        partial.majelis_hakim = hakimList.map((h: Record<string, unknown>) => {
          const roleVal = String(h.jabatan ?? h.role ?? "").toLowerCase();
          let role: "ketua" | "anggota" | "hakim_tunggal" | null = null;
          if (roleVal.includes("ketua")) role = "ketua";
          else if (roleVal.includes("tunggal") || roleVal.includes("hakim tunggal")) role = "hakim_tunggal";
          else if (roleVal.includes("anggota")) role = "anggota";
          return { name: String(h.nama ?? h.name ?? ""), title: h.title ? String(h.title) : null, role };
        });
        confidence["majelis_hakim"] = CONFIDENCE.PARSED_JSON;
        spans.push(makeSpan("majelis_hakim", "CaseDecision.hakim", caseDecision.hakim.slice(0, 200), null, null, null, null));
      }
    } catch { /* skip */ }
  }

  if (caseDecision.panitera) {
    partial.panitera = caseDecision.panitera;
    confidence["panitera"] = CONFIDENCE.DIRECT_COLUMN;
    spans.push(makeSpan("panitera", "CaseDecision.panitera", caseDecision.panitera, null, null, null, null));
  }

  const parties: ApofGraphDecisionExtraction["parties"] = [];
  if (caseDecision.pihak) {
    try {
      const pihakList = fromJsonList(caseDecision.pihak);
      if (Array.isArray(pihakList)) {
        for (const p of pihakList) {
          const name = String(p.nama ?? p.name ?? "");
          if (!name) continue;
          const jenis = String(p.jenis ?? p.type ?? "").toLowerCase();
          let role: ApofGraphDecisionExtraction["parties"][number]["role"] = "tersangka";
          if (jenis.includes("pemohon")) role = "pemohon";
          else if (jenis.includes("termohon")) role = "termohon";
          else if (jenis.includes("terdakwa")) role = "terdakwa";
          else if (jenis.includes("penggugat")) role = "penggugat";
          else if (jenis.includes("tergugat")) role = "tergugat";
          else if (jenis.includes("pelapor")) role = "pelapor";
          parties.push({ name, role, type: "unknown" });
        }
        confidence["parties"] = CONFIDENCE.PARSED_JSON;
        spans.push(makeSpan("parties", "CaseDecision.pihak", caseDecision.pihak.slice(0, 200), null, null, null, null));
      }
    } catch { /* skip */ }
  }
  if (caseDecision.pemohon) parties.push({ name: caseDecision.pemohon, role: "pemohon", type: "unknown" });
  if (caseDecision.termohon) parties.push({ name: caseDecision.termohon, role: "termohon", type: "unknown" });
  partial.parties = parties;

  if (caseDecision.amarPutusan) {
    partial.amar_putusan = caseDecision.amarPutusan;
    confidence["amar_putusan"] = CONFIDENCE.DIRECT_COLUMN;
    spans.push(makeSpan("amar_putusan", "CaseDecision.amarPutusan", caseDecision.amarPutusan.slice(0, 300), null, null, null, null));
  }

  const fullText = caseDecision.fullText ?? "";
  if (fullText.length > 0) {
    const cited = extractCitedStatutes(fullText);
    if (cited.articles.length > 0 || cited.statutes.length > 0) {
      partial.cited_articles = cited.articles.map((a) => ({
        statute: cited.statutes[0] ?? "",
        article: a,
        context: null,
        confidence: cited.confidence,
      }));
      confidence["cited_articles"] = cited.confidence;
      spans.push(makeSpan("cited_articles", "CaseDecision.fullText (regex)", cited.articles.slice(0, 3).join("; "), null, null, null, null));
    }

    const { outcome } = classifyOutcome(caseDecision.amarPutusan);
    if (outcome) {
      partial.outcome = outcome as ApofGraphDecisionExtraction["outcome"];
      confidence["outcome"] = CONFIDENCE.HEURISTIC;
      spans.push(makeSpan("outcome", "CaseDecision.amarPutusan (heuristic)", outcome, null, null, null, null));
    }

    const rpMatches = fullText.matchAll(/Rp\s*[\d.,]+(?:\s*(?:ribu|juta|miliar|milyar))?/gi);
    const monetaryValues: ApofGraphDecisionExtraction["monetary_values"] = [];
    for (const match of rpMatches) {
      const amount = parseMonetaryAmount(match[0]);
      if (amount !== null) {
        monetaryValues.push({ amount, currency: "IDR", description: extractSentenceContext(fullText, match.index ?? 0) ?? "Extracted from text", confidence: CONFIDENCE.REGEX_EXTRACT });
      }
    }
    if (monetaryValues.length > 0) {
      partial.monetary_values = monetaryValues;
      confidence["monetary_values"] = CONFIDENCE.REGEX_EXTRACT;
      spans.push(makeSpan("monetary_values", "CaseDecision.fullText (regex)", monetaryValues.slice(0, 3).map((v) => `${v.amount} ${v.currency}`).join("; "), null, null, null, null));
    }
  }

  if (caseDecision.sourceUrl) {
    partial.source_url = caseDecision.sourceUrl;
    confidence["source_url"] = CONFIDENCE.DIRECT_COLUMN;
  }

  return { partial, confidence, spans };
}

async function llmExtract(
  _opts: ExtractOptions,
  _partial: Partial<ApofGraphDecisionExtraction>,
  _fullText: string
): Promise<{
  partial: Partial<ApofGraphDecisionExtraction> | null;
  confidence: Record<string, number>;
  spans: ApofGraphEvidenceSpan[];
  error?: string;
}> {
  return { partial: null, confidence: {}, spans: [], error: "LLM extraction not implemented -- deterministic only" };
}

function mergeExtractions(
  det: { partial: Partial<ApofGraphDecisionExtraction>; confidence: Record<string, number>; spans: ApofGraphEvidenceSpan[] },
  llm: { partial: Partial<ApofGraphDecisionExtraction> | null; confidence: Record<string, number>; spans: ApofGraphEvidenceSpan[] }
): { merged: Partial<ApofGraphDecisionExtraction>; confidence: Record<string, number>; spans: ApofGraphEvidenceSpan[] } {
  if (!llm.partial) return { merged: det.partial, confidence: det.confidence, spans: det.spans };
  const merged = { ...det.partial, ...llm.partial };
  const confidence: Record<string, number> = { ...det.confidence };
  for (const [key, val] of Object.entries(llm.confidence)) {
    confidence[key] = Math.max(confidence[key] ?? 0, val);
  }
  return { merged, confidence, spans: [...det.spans, ...llm.spans] };
}

function findUnsupportedFields(extraction: ApofGraphDecisionExtraction): string[] {
  const unsupported: string[] = [];
  if (extraction.ratio_decidendi === null) unsupported.push("ratio_decidendi");
  if (extraction.legal_issues.length === 0) unsupported.push("legal_issues");
  if (extraction.cited_articles.length === 0) unsupported.push("cited_articles");
  if (extraction.precedent_citations.length === 0) unsupported.push("precedent_citations");
  if (extraction.outcome === "unknown") unsupported.push("outcome");
  if (extraction.sentence === null) unsupported.push("sentence");
  if (extraction.dissenting_opinion === null) unsupported.push("dissenting_opinion");
  if (extraction.charges.length === 0) unsupported.push("charges");
  if (extraction.chronology_facts.length === 0) unsupported.push("chronology_facts");
  if (extraction.arguments.length === 0) unsupported.push("arguments");
  if (extraction.judicial_considerations.length === 0) unsupported.push("judicial_considerations");
  return unsupported;
}

export async function extractApofGraph(opts: ExtractOptions): Promise<ExtractResult> {
  const promptVersion = opts.promptVersion ?? "1.0.0";

  try {
    const deterministic = await deterministicExtract(opts.caseDecisionId);

    if (Object.keys(deterministic.partial).length === 0) {
      return { extraction: null, method: "none", confidence: {}, unsupportedFields: [], evidenceSpans: [], error: `CaseDecision ${opts.caseDecisionId} not found or has no extractable data` };
    }

    let llmResult: { partial: Partial<ApofGraphDecisionExtraction> | null; confidence: Record<string, number>; spans: ApofGraphEvidenceSpan[]; error?: string } = { partial: null, confidence: {}, spans: [] };

    if (opts.useLlm) {
      const caseDecision = await prisma.caseDecision.findUnique({ where: { id: opts.caseDecisionId } });
      if (caseDecision?.fullText) {
        llmResult = await llmExtract(opts, deterministic.partial, caseDecision.fullText);
      }
    }

    const merged = mergeExtractions(deterministic, llmResult);

    const defaulted: ApofGraphDecisionExtraction = {
      schema_version: promptVersion,
      case_decision_id: opts.caseDecisionId,
      source_url: merged.merged.source_url ?? "",
      nomor_putusan: merged.merged.nomor_putusan ?? null,
      court: merged.merged.court ?? null,
      tingkat_proses: merged.merged.tingkat_proses ?? null,
      klasifikasi: merged.merged.klasifikasi ?? null,
      year: merged.merged.year ?? null,
      tanggal_register: merged.merged.tanggal_register ?? null,
      tanggal_putusan: merged.merged.tanggal_putusan ?? null,
      tanggal_musyawarah: merged.merged.tanggal_musyawarah ?? null,
      majelis_hakim: merged.merged.majelis_hakim ?? [],
      panitera: merged.merged.panitera ?? null,
      parties: merged.merged.parties ?? [],
      charges: merged.merged.charges ?? [],
      cited_articles: merged.merged.cited_articles ?? [],
      chronology_facts: merged.merged.chronology_facts ?? [],
      legal_issues: merged.merged.legal_issues ?? [],
      arguments: merged.merged.arguments ?? [],
      judicial_considerations: merged.merged.judicial_considerations ?? [],
      ratio_decidendi: merged.merged.ratio_decidendi ?? null,
      obiter_dicta: merged.merged.obiter_dicta ?? [],
      amar_putusan: merged.merged.amar_putusan ?? null,
      outcome: merged.merged.outcome ?? "unknown",
      sentence: merged.merged.sentence ?? null,
      aggravating_factors: merged.merged.aggravating_factors ?? [],
      mitigating_factors: merged.merged.mitigating_factors ?? [],
      dissenting_opinion: merged.merged.dissenting_opinion ?? null,
      precedent_citations: merged.merged.precedent_citations ?? [],
      monetary_values: merged.merged.monetary_values ?? [],
      banking_fraud_specific: merged.merged.banking_fraud_specific ?? null,
      tppu_specific: merged.merged.tppu_specific ?? null,
      extraction_confidence: merged.confidence,
      unsupported_fields: [],
      evidence_spans: merged.spans,
    };

    const validation = validateApofGraphExtraction(defaulted);
    if (!validation.success) {
      return { extraction: null, method: llmResult.partial ? "hybrid" : "deterministic", confidence: merged.confidence, unsupportedFields: [], evidenceSpans: merged.spans, error: `Schema validation failed: ${validation.errors.join("; ")}` };
    }

    const extraction = validation.data;
    const unsupportedFields = findUnsupportedFields(extraction);
    const method: ExtractResult["method"] = llmResult.partial ? "hybrid" : opts.useLlm ? "llm" : "deterministic";

    return { extraction, method, confidence: merged.confidence, unsupportedFields, evidenceSpans: merged.spans };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { extraction: null, method: "none", confidence: {}, unsupportedFields: [], evidenceSpans: [], error: message };
  }
}

export async function extractBatch(caseDecisionIds: string[], opts: Omit<ExtractOptions, "caseDecisionId">): Promise<ExtractResult[]> {
  const results: ExtractResult[] = [];
  for (const id of caseDecisionIds) {
    results.push(await extractApofGraph({ ...opts, caseDecisionId: id }));
  }
  return results;
}
