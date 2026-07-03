/**
 * Shared TypeScript types used by Apof Graph UI components.
 *
 * These types mirror the Zod schema shapes but are kept separate so that
 * UI code can import them without pulling in the full validation pipeline.
 */

// ---------------------------------------------------------------------------
// Normalized entities returned by the API
// ---------------------------------------------------------------------------

export interface NormalizedJudge {
  name: string;
  title: string | null;
  role: string;
}

export interface NormalizedIssue {
  label: string;
  category: string;
  confidence: number;
}

export interface NormalizedArticle {
  statute: string;
  article: string;
  context: string | null;
}

export interface NormalizedSentence {
  type: string;
  durationMonths: number | null;
  fineAmount: number | null;
  restitutionAmount: number | null;
}

// ---------------------------------------------------------------------------
// API response shapes
// ---------------------------------------------------------------------------

export interface ExtractionResponse {
  extraction: {
    schema_version: string;
    case_decision_id: string;
    source_url: string;
    nomor_putusan: string | null;
    court: string | null;
    tingkat_proses: string | null;
    klasifikasi: string | null;
    year: number | null;
    tanggal_register: string | null;
    tanggal_putusan: string | null;
    tanggal_musyawarah: string | null;
    majelis_hakim: Array<{ name: string; title: string | null; role: string | null }>;
    panitera: string | null;
    parties: Array<{ name: string; role: string; type: string }>;
    charges: unknown[];
    cited_articles: Array<{ statute: string; article: string; context: string | null; confidence: number }>;
    chronology_facts: unknown[];
    legal_issues: Array<{ issue: string; category: string; sub_issues: string[]; confidence: number }>;
    arguments: unknown[];
    judicial_considerations: unknown[];
    ratio_decidendi: string | null;
    obiter_dicta: string[];
    amar_putusan: string | null;
    outcome: string;
    sentence: {
      type: string;
      duration_months: number | null;
      fine_amount: number | null;
      fine_currency: string;
      restitution_amount: number | null;
      restitution_currency: string;
      probation_months: number | null;
      additional_penalties: string[];
      confidence: number;
    } | null;
    aggravating_factors: Array<{ factor: string; confidence: number }>;
    mitigating_factors: Array<{ factor: string; confidence: number }>;
    dissenting_opinion: string | null;
    precedent_citations: unknown[];
    monetary_values: Array<{ amount: number; currency: string; description: string; confidence: number }>;
    banking_fraud_specific: {
      is_banking_related: boolean;
      fraud_type: string[];
      bank_name: string | null;
      transaction_amount: number | null;
      number_of_transactions: number | null;
      involved_parties: string[];
      confidence: number;
    } | null;
    tppu_specific: {
      is_tppu_related: boolean;
      predicate_offense: string | null;
      tppu_stage: string[];
      reporting_entity: string | null;
      suspicious_transaction_indicators: string[];
      asset_concealment_methods: string[];
      beneficial_ownership_complexity: string;
      cross_border_element: boolean;
      confidence: number;
    } | null;
    extraction_confidence: Record<string, number>;
    unsupported_fields: string[];
    evidence_spans: Array<{
      target_path: string;
      chunk_id: string | null;
      source_id: string;
      page_start: number | null;
      page_end: number | null;
      paragraph_start: number | null;
      paragraph_end: number | null;
      quote: string;
    }>;
    confidence: Record<string, number>;
    unsupportedFields: string[];
    evidenceSpans: Array<{
      target_path: string;
      chunk_id: string | null;
      source_id: string;
      page_start: number | null;
      page_end: number | null;
      paragraph_start: number | null;
      paragraph_end: number | null;
      quote: string;
    }>;
  } | null;
  status: string;
  version?: string;
  normalized: {
    judges: NormalizedJudge[];
    issues: NormalizedIssue[];
    articles: NormalizedArticle[];
    sentences: NormalizedSentence[];
  };
}

// ---------------------------------------------------------------------------
// Dashboard analytics
// ---------------------------------------------------------------------------

export interface DashboardData {
  totalCases: number;
  extractedCases: number;
  totalJudges: number;
  totalLegalIssues: number;
  totalStatutes: number;
  totalArticles: number;
  totalSentences: number;
  totalCitations: number;
  pendingReviews: number;
  issueDistribution: Array<{ label: string; count: number }>;
  outcomeDistribution: Array<{ outcome: string; count: number }>;
  extractionStatusDistribution: Array<{ status: string; count: number }>;
}

export interface RecentExtraction {
  id: string;
  nomorPutusan: string | null;
  pengadilan: string | null;
  status: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Similar cases
// ---------------------------------------------------------------------------

export interface SimilarCase {
  caseDecisionId: string;
  nomorPutusan: string | null;
  pengadilan: string | null;
  tahun: number | null;
  score: number;
  explanation: {
    sharedLegalIssues: string[];
    sharedArticles: string[];
    sharedJudges: string[];
    outcomeMatch: boolean;
    compositeScore: number;
  };
}

// ---------------------------------------------------------------------------
// Review queue
// ---------------------------------------------------------------------------

export interface ReviewQueueItem {
  id: string;
  caseDecisionId: string;
  nomorPutusan: string | null;
  status: string;
  priority: string;
  reviewType: string;
  createdAt: string;
  notes: string | null;
}

// ---------------------------------------------------------------------------
// Research memo
// ---------------------------------------------------------------------------

export interface ResearchMemo {
  title: string;
  generatedAt: string;
  disclaimer: string;
  sections: Array<{
    heading: string;
    content: string;
    sourceCaseIds: string[];
    confidence: number;
  }>;
  citations: Array<{
    caseId: string;
    nomorPutusan: string | null;
    sourceUrl: string;
    field: string;
    quote: string | null;
  }>;
  confidenceWarnings: string[];
}
