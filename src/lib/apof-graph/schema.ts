/**
 * Zod schema for Apof Graph structured legal data extraction.
 *
 * This is the single source of truth for the shape of extracted data.
 * Every consumer (extract.ts, persist.ts, API routes, UI) must align
 * with these field names exactly.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Evidence span — ties an extracted field back to source text
// ---------------------------------------------------------------------------

export const EvidenceSpanSchema = z.object({
  target_path: z.string(),
  chunk_id: z.string().nullable(),
  source_id: z.string(),
  page_start: z.number().int().nullable(),
  page_end: z.number().int().nullable(),
  paragraph_start: z.number().int().nullable(),
  paragraph_end: z.number().int().nullable(),
  quote: z.string(),
});

export type ApofGraphEvidenceSpan = z.infer<typeof EvidenceSpanSchema>;

// ---------------------------------------------------------------------------
// Sub-schemas
// ---------------------------------------------------------------------------

const JudgeEntrySchema = z.object({
  name: z.string(),
  title: z.string().nullable(),
  role: z.enum(["ketua", "anggota", "hakim_tunggal"]).nullable(),
});

const PartyEntrySchema = z.object({
  name: z.string(),
  role: z.enum([
    "pemohon",
    "termohon",
    "terdakwa",
    "penggugat",
    "tergugat",
    "pelapor",
    "tersangka",
  ]),
  type: z.enum(["individual", "corporate", "bank", "government", "unknown"]).default("unknown"),
});

const ChargeEntrySchema = z.object({
  description: z.string(),
  articles: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

const CitedArticleSchema = z.object({
  statute: z.string(),
  article: z.string(),
  context: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

const ChronologyFactSchema = z.object({
  date: z.string().nullable(),
  event: z.string(),
  evidence_type: z.enum(["document", "testimony", "expert", "physical", "other", "unknown"]).default("unknown"),
  confidence: z.number().min(0).max(1),
});

const LegalIssueEntrySchema = z.object({
  issue: z.string(),
  category: z.string(),
  sub_issues: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
});

const ArgumentEntrySchema = z.object({
  party: z.string(),
  argument_text: z.string(),
  argument_type: z.enum(["prosecution", "defense", "plaintiff", "defendant", "amicus", "other"]).default("other"),
  confidence: z.number().min(0).max(1),
});

const JudicialConsiderationSchema = z.object({
  section: z.string(),
  text: z.string(),
  confidence: z.number().min(0).max(1),
});

const SentenceSchema = z.object({
  type: z.enum([
    "imprisonment",
    "fine",
    "confiscation",
    "restitution",
    "death",
    "community_service",
    "probation",
    "acquittal",
    "none",
    "unknown",
  ]).default("unknown"),
  duration_months: z.number().int().nullable(),
  fine_amount: z.number().nullable(),
  fine_currency: z.string().default("IDR"),
  restitution_amount: z.number().nullable(),
  restitution_currency: z.string().default("IDR"),
  probation_months: z.number().int().nullable(),
  additional_penalties: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
});

const FactorSchema = z.object({
  factor: z.string(),
  confidence: z.number().min(0).max(1),
});

const PrecedentCitationSchema = z.object({
  nomor_putusan: z.string(),
  treatment: z.enum(["followed", "distinguished", "referred", "reversed", "overruled", "unknown"]).default("unknown"),
  context: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

const MonetaryValueSchema = z.object({
  amount: z.number(),
  currency: z.string().default("IDR"),
  description: z.string(),
  confidence: z.number().min(0).max(1),
});

const BankingFraudSpecificSchema = z.object({
  is_banking_related: z.boolean().default(false),
  fraud_type: z.array(
    z.enum([
      "unauthorized_transfer",
      "credit_fraud",
      "account_misuse",
      "loan_fraud",
      "embezzlement",
      "money_laundering",
      "identity_theft",
      "check_fraud",
      "other",
      "unknown",
    ])
  ).default([]),
  bank_name: z.string().nullable(),
  transaction_amount: z.number().nullable(),
  number_of_transactions: z.number().int().nullable(),
  involved_parties: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
});

const TPPUSchema = z.object({
  is_tppu_related: z.boolean().default(false),
  predicate_offense: z.string().nullable(),
  tppu_stage: z.array(z.enum(["placement", "layering", "integration", "unknown"])).default([]),
  reporting_entity: z.string().nullable(),
  suspicious_transaction_indicators: z.array(z.string()).default([]),
  asset_concealment_methods: z.array(z.string()).default([]),
  beneficial_ownership_complexity: z.enum(["simple", "moderate", "complex", "unknown"]).default("unknown"),
  cross_border_element: z.boolean().default(false),
  confidence: z.number().min(0).max(1),
});

// ---------------------------------------------------------------------------
// Master extraction schema
// ---------------------------------------------------------------------------

export const ApofGraphDecisionExtractionSchema = z.object({
  schema_version: z.string(),
  case_decision_id: z.string(),
  source_url: z.string(),
  nomor_putusan: z.string().nullable(),
  court: z.string().nullable(),
  tingkat_proses: z.string().nullable(),
  klasifikasi: z.string().nullable(),
  year: z.number().int().nullable(),
  tanggal_register: z.string().nullable(),
  tanggal_putusan: z.string().nullable(),
  tanggal_musyawarah: z.string().nullable(),
  majelis_hakim: z.array(JudgeEntrySchema),
  panitera: z.string().nullable(),
  parties: z.array(PartyEntrySchema),
  charges: z.array(ChargeEntrySchema),
  cited_articles: z.array(CitedArticleSchema),
  chronology_facts: z.array(ChronologyFactSchema),
  legal_issues: z.array(LegalIssueEntrySchema),
  arguments: z.array(ArgumentEntrySchema),
  judicial_considerations: z.array(JudicialConsiderationSchema),
  ratio_decidendi: z.string().nullable(),
  obiter_dicta: z.array(z.string()).default([]),
  amar_putusan: z.string().nullable(),
  outcome: z.enum([
    "guilty", "not_guilty", "partially_guilty", "acquitted",
    "rehabilitated", "dismissed", "granted", "denied", "unknown",
  ]).default("unknown"),
  sentence: SentenceSchema.nullable(),
  aggravating_factors: z.array(FactorSchema).default([]),
  mitigating_factors: z.array(FactorSchema).default([]),
  dissenting_opinion: z.string().nullable(),
  precedent_citations: z.array(PrecedentCitationSchema).default([]),
  monetary_values: z.array(MonetaryValueSchema).default([]),
  banking_fraud_specific: BankingFraudSpecificSchema.nullable(),
  tppu_specific: TPPUSchema.nullable(),
  extraction_confidence: z.record(z.string(), z.number().min(0).max(1)),
  unsupported_fields: z.array(z.string()).default([]),
  evidence_spans: z.array(EvidenceSpanSchema).default([]),
});

// ---------------------------------------------------------------------------
// Types & validation helper
// ---------------------------------------------------------------------------

export type ApofGraphDecisionExtraction = z.infer<
  typeof ApofGraphDecisionExtractionSchema
>;

export function validateApofGraphExtraction(
  data: unknown
):
  | { success: true; data: ApofGraphDecisionExtraction }
  | { success: false; errors: string[] } {
  const result = ApofGraphDecisionExtractionSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.errors.map(
      (e) => `${e.path.join(".")}: ${e.message}`
    ),
  };
}
