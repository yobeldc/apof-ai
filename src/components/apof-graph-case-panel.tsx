"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Network,
  Loader2,
  Play,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  FileText,
  Scale,
  Gavel,
  Users,
  Lightbulb,
  ListTree,
  Banknote,
  Landmark,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ExternalLink,
  Tag,
  BarChart3,
  Quote,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import type {
  ExtractionResponse,
  NormalizedJudge,
  NormalizedIssue,
  NormalizedArticle,
  NormalizedSentence,
} from "@/lib/apof-graph/ui-types";

interface Props {
  caseId: string;
}

export function ApofGraphCasePanel({ caseId }: Props) {
  const [data, setData] = React.useState<ExtractionResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [extracting, setExtracting] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/apof-graph`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExtract = async () => {
    setExtracting(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/apof-graph/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useLlm: false }),
      });
      if (res.ok) {
        toast.success("Extraction started");
        await fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Extraction failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setExtracting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.extraction === null) {
    return (
      <EmptyState
        status={data?.status ?? "pending"}
        onExtract={handleExtract}
        extracting={extracting}
      />
    );
  }

  const ex = data.extraction;
  const norm = data.normalized;
  const confidence = (ex.confidence as Record<string, number>) ?? {};
  const avgConfidence =
    Object.keys(confidence).length > 0
      ? Object.values(confidence).reduce((a, b) => a + b, 0) /
        Object.keys(confidence).length
      : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StatusBadge status={data.status} />
          {data.version && (
            <Badge variant="outline">v{data.version}</Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleExtract}
          disabled={extracting}
        >
          {extracting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          Re-run
        </Button>
      </div>

      {/* Confidence bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Overall confidence</span>
          <span className="font-medium">{Math.round(avgConfidence * 100)}%</span>
        </div>
        <Progress value={avgConfidence * 100} className="h-2" />
      </div>

      <Separator />

      {/* Content */}
      <ScrollArea className="h-[600px]">
        <Accordion type="multiple" defaultValue={["metadata", "issues"]} className="space-y-2">
          <Section icon={FileText} title="Metadata" value="metadata">
            <MetadataGrid
              nomor={ex.nomor_putusan}
              court={ex.court}
              tingkat={ex.tingkat_proses}
              klasifikasi={ex.klasifikasi}
              year={ex.year}
              source={ex.source_url}
            />
          </Section>

          <Section icon={Users} title={`Judges (${norm?.judges?.length ?? 0})`} value="judges">
            <JudgeList judges={norm?.judges ?? []} />
          </Section>

          <Section icon={Scale} title={`Legal Issues (${norm?.issues?.length ?? 0})`} value="issues">
            <IssueList issues={norm?.issues ?? []} />
          </Section>

          <Section icon={BookOpen} title={`Cited Articles (${norm?.articles?.length ?? 0})`} value="articles">
            <ArticleList articles={norm?.articles ?? []} />
          </Section>

          <Section icon={Lightbulb} title="Ratio Decidendi" value="ratio">
            <RatioDisplay text={ex.ratio_decidendi} confidence={confidence["ratio_decidendi"]} />
          </Section>

          <Section icon={Gavel} title="Amar / Outcome" value="amar">
            <AmarDisplay text={ex.amar_putusan} outcome={ex.outcome} />
          </Section>

          <Section icon={Landmark} title="Sentence" value="sentence">
            <SentenceDisplay sentences={norm?.sentences ?? []} />
          </Section>

          <Section icon={Banknote} title={`Monetary Values (${ex.monetary_values?.length ?? 0})`} value="monetary">
            <MonetaryList values={ex.monetary_values ?? []} />
          </Section>

          <Section icon={Tag} title="Domain Tags" value="domain">
            <DomainTags banking={ex.banking_fraud_specific} tppu={ex.tppu_specific} />
          </Section>

          {ex.unsupported_fields && ex.unsupported_fields.length > 0 && (
            <Section icon={ShieldAlert} title={`Unsupported (${ex.unsupported_fields.length})`} value="unsupported">
              <UnsupportedList fields={ex.unsupported_fields} />
            </Section>
          )}

          <Section icon={BarChart3} title="Evidence Spans" value="evidence">
            <EvidenceList spans={ex.evidence_spans ?? []} />
          </Section>
        </Accordion>
      </ScrollArea>
    </div>
  );
}

// ---- Sub-components ----

function EmptyState({
  status,
  onExtract,
  extracting,
}: {
  status: string;
  onExtract: () => void;
  extracting: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <Network className="h-12 w-12 text-muted-foreground" />
      <h3 className="text-lg font-medium">No Apof Graph extraction yet</h3>
      <p className="text-sm text-muted-foreground max-w-md text-center">
        Run extraction to analyze this case&apos;s structured legal data:
        judges, articles, legal issues, ratio decidendi, and more.
      </p>
      <Button onClick={onExtract} disabled={extracting}>
        {extracting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Play className="mr-2 h-4 w-4" />
        )}
        Run Extraction
      </Button>
      <p className="text-xs text-muted-foreground">
        Uses deterministic parsing (no LLM required). LLM-assisted extraction available via API.
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { icon: React.ElementType; color: string }> = {
    complete: { icon: CheckCircle2, color: "bg-green-100 text-green-800" },
    extracting: { icon: Loader2, color: "bg-blue-100 text-blue-800" },
    failed: { icon: XCircle, color: "bg-red-100 text-red-800" },
    needs_review: { icon: AlertTriangle, color: "bg-yellow-100 text-yellow-800" },
    pending: { icon: Clock, color: "bg-gray-100 text-gray-800" },
  };
  const v = variants[status] ?? variants.pending;
  const Icon = v.icon;
  return (
    <Badge className={v.color}>
      <Icon className="mr-1 h-3 w-3" />
      {status}
    </Badge>
  );
}

function Section({
  icon: Icon,
  title,
  value,
  children,
}: {
  icon: React.ElementType;
  title: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem value={value}>
      <AccordionTrigger>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span>{title}</span>
        </div>
      </AccordionTrigger>
      <AccordionContent>{children}</AccordionContent>
    </AccordionItem>
  );
}

function MetadataGrid({
  nomor,
  court,
  tingkat,
  klasifikasi,
  year,
  source,
}: {
  nomor: string | null;
  court: string | null;
  tingkat: string | null;
  klasifikasi: string | null;
  year: number | null;
  source: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 text-sm">
      <KV label="Nomor Putusan" value={nomor} />
      <KV label="Court" value={court} />
      <KV label="Tingkat Proses" value={tingkat} />
      <KV label="Klasifikasi" value={klasifikasi} />
      <KV label="Year" value={year?.toString() ?? null} />
      <div className="col-span-2">
        {source && (
          <a
            href={source}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-600 hover:underline text-xs"
          >
            <ExternalLink className="h-3 w-3" />
            Source URL
          </a>
        )}
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <span className="text-muted-foreground text-xs">{label}</span>
      <p className="font-medium">{value ?? "—"}</p>
    </div>
  );
}

function JudgeList({ judges }: { judges: NormalizedJudge[] }) {
  if (judges.length === 0) return <p className="text-sm text-muted-foreground">No judges extracted</p>;
  return (
    <div className="space-y-1">
      {judges.map((j, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <Badge variant="outline" className="text-xs capitalize">
            {j.role}
          </Badge>
          <span>{j.name}</span>
          {j.title && <span className="text-muted-foreground text-xs">({j.title})</span>}
        </div>
      ))}
    </div>
  );
}

function IssueList({ issues }: { issues: NormalizedIssue[] }) {
  if (issues.length === 0) return <p className="text-sm text-muted-foreground">No issues extracted</p>;
  return (
    <div className="space-y-1">
      {issues.map((issue, i) => (
        <div key={i} className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {issue.category}
            </Badge>
            <span>{issue.label}</span>
          </div>
          <ConfidenceDot confidence={issue.confidence} />
        </div>
      ))}
    </div>
  );
}

function ArticleList({ articles }: { articles: NormalizedArticle[] }) {
  if (articles.length === 0) return <p className="text-sm text-muted-foreground">No articles extracted</p>;
  return (
    <div className="space-y-1">
      {articles.map((a, i) => (
        <div key={i} className="text-sm">
          <span className="font-medium">{a.statute}</span> — <span>Pasal {a.article}</span>
          {a.context && <p className="text-xs text-muted-foreground mt-0.5">{a.context}</p>}
        </div>
      ))}
    </div>
  );
}

function RatioDisplay({ text, confidence }: { text: string | null; confidence?: number }) {
  if (!text) return <p className="text-sm text-muted-foreground">No ratio decidendi extracted</p>;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ConfidenceDot confidence={confidence ?? 0} />
      </div>
      <p className="text-sm leading-relaxed border-l-2 border-blue-300 pl-3">{text}</p>
    </div>
  );
}

function AmarDisplay({ text, outcome }: { text: string | null; outcome: string }) {
  return (
    <div className="space-y-2">
      <Badge
        variant={outcome === "granted" || outcome === "guilty" ? "default" : "secondary"}
        className="capitalize"
      >
        {outcome}
      </Badge>
      {text && <p className="text-sm border-l-2 border-green-300 pl-3">{text}</p>}
    </div>
  );
}

function SentenceDisplay({ sentences }: { sentences: NormalizedSentence[] }) {
  if (sentences.length === 0) return <p className="text-sm text-muted-foreground">No sentence extracted</p>;
  return (
    <div className="space-y-1">
      {sentences.map((s, i) => (
        <div key={i} className="text-sm">
          <Badge variant="outline" className="capitalize mr-2">{s.type}</Badge>
          {s.durationMonths != null && <span>{s.durationMonths} months</span>}
          {s.fineAmount != null && <span className="ml-2">Fine: Rp {s.fineAmount.toLocaleString()}</span>}
          {s.restitutionAmount != null && (
            <span className="ml-2">Restitution: Rp {s.restitutionAmount.toLocaleString()}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function MonetaryList({ values }: { values: Array<{ amount: number; currency: string; description: string }> }) {
  if (values.length === 0) return <p className="text-sm text-muted-foreground">No monetary values extracted</p>;
  return (
    <div className="space-y-1">
      {values.map((v, i) => (
        <div key={i} className="flex items-center justify-between text-sm">
          <span>{v.description}</span>
          <span className="font-medium">
            {v.currency} {v.amount.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

function DomainTags({
  banking,
  tppu,
}: {
  banking: { is_banking_related?: boolean; fraud_type?: string[]; bank_name?: string | null } | null;
  tppu: { is_tppu_related?: boolean; predicate_offense?: string | null } | null;
}) {
  return (
    <div className="space-y-2 text-sm">
      {banking?.is_banking_related && (
        <div>
          <Badge variant="outline" className="mb-1">Banking/Fraud</Badge>
          <p>Bank: {banking.bank_name ?? "—"}</p>
          <p>Type: {banking.fraud_type?.join(", ") ?? "—"}</p>
        </div>
      )}
      {tppu?.is_tppu_related && (
        <div>
          <Badge variant="outline" className="mb-1">TPPU</Badge>
          <p>Predicate: {tppu.predicate_offense ?? "—"}</p>
        </div>
      )}
      {!banking?.is_banking_related && !tppu?.is_tppu_related && (
        <p className="text-muted-foreground">No domain-specific tags</p>
      )}
    </div>
  );
}

function UnsupportedList({ fields }: { fields: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {fields.map((f) => (
        <Badge key={f} variant="outline" className="text-xs text-muted-foreground">
          {f}
        </Badge>
      ))}
    </div>
  );
}

function EvidenceList({ spans }: { spans: Array<{ target_path: string; quote: string; source_id: string }> }) {
  if (spans.length === 0) return <p className="text-sm text-muted-foreground">No evidence spans recorded</p>;
  return (
    <div className="space-y-2 max-h-48 overflow-y-auto">
      {spans.slice(0, 20).map((span, i) => (
        <div key={i} className="text-xs border-l-2 border-gray-300 pl-2">
          <span className="font-medium text-muted-foreground">{span.target_path}</span>
          <p className="italic mt-0.5">&ldquo;{span.quote.slice(0, 200)}&rdquo;</p>
          <span className="text-muted-foreground">{span.source_id}</span>
        </div>
      ))}
      {spans.length > 20 && (
        <p className="text-xs text-muted-foreground">+ {spans.length - 20} more spans</p>
      )}
    </div>
  );
}

function ConfidenceDot({ confidence }: { confidence: number }) {
  const color =
    confidence >= 0.8 ? "bg-green-400" : confidence >= 0.5 ? "bg-yellow-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-1" title={`Confidence: ${Math.round(confidence * 100)}%`}>
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="text-xs text-muted-foreground">{Math.round(confidence * 100)}%</span>
    </div>
  );
}
