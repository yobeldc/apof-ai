"use client";

import * as React from "react";
import {
  Sparkles,
  Send,
  Loader2,
  AlertTriangle,
  FileText,
  ChevronDown,
  ChevronUp,
  Quote,
  Database,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type Citation = {
  sourceId: string;
  chunkId: string;
  quote: string;
  pageStart?: number | null;
  pageEnd?: number | null;
  sectionTitle?: string | null;
  sectionKind?: string | null;
};
type Evidence = {
  sourceId: string;
  text: string;
  score: number;
  source: string;
  caseNumber?: string | null;
  sectionTitle?: string | null;
  sectionKind?: string | null;
  pageStart?: number | null;
  pageEnd?: number | null;
};
type RagAnswer = {
  answer: string;
  simpleExplanation: string;
  citations: Citation[];
  evidence: Evidence[];
  notFound: boolean;
  confidence: "high" | "medium" | "low";
  limitations: string[];
};
type RagStatus = {
  enabled: boolean;
  embeddingProvider: string;
  llmProvider: string;
  llmModel: string;
  counts: { cases: number; chunks: number; embeddedChunks: number };
  warnings: string[];
  suggestions: string[];
};

const SUGGESTED = [
  "Ringkas perkara ini untuk pemula.",
  "Apa fakta penting dalam perkara ini?",
  "Apa isu hukumnya?",
  "Apa pertimbangan hukum hakim?",
  "Apa amar putusannya?",
  "Pasal apa saja yang disebut?",
  "Apa ratio decidendi-nya?",
  "Apa akibat hukum putusan ini?",
  "Apa yang tidak ditemukan dalam dokumen?",
];

const CONF_VARIANT = { high: "success", medium: "warning", low: "outline" } as const;

export function AskApofPanel({ caseId }: { caseId?: string }) {
  const [question, setQuestion] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [indexing, setIndexing] = React.useState(false);
  const [result, setResult] = React.useState<RagAnswer | null>(null);
  const [status, setStatus] = React.useState<RagStatus | null>(null);

  const loadStatus = React.useCallback(async () => {
    try {
      const res = await fetch("/api/rag/status");
      if (res.ok) setStatus(await res.json());
    } catch {
      /* ignore */
    }
  }, []);
  React.useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const ask = async (q?: string) => {
    const question_ = (q ?? question).trim();
    if (!question_) return;
    setQuestion(question_);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/rag/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question_, ...(caseId ? { caseDecisionId: caseId } : {}), topK: 6 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Query failed");
      setResult(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Query failed");
    } finally {
      setLoading(false);
    }
  };

  const runIndex = async () => {
    setIndexing(true);
    try {
      const res = await fetch("/api/rag/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(caseId ? { caseDecisionId: caseId } : {}),
      });
      if (!res.ok) throw new Error("Index failed");
      toast.success(caseId ? "Case indexed for Apof.ai" : "All cases indexed for Apof.ai");
      await loadStatus();
    } catch {
      toast.error("Could not index");
    } finally {
      setIndexing(false);
    }
  };

  const isMock = status && (status.embeddingProvider === "mock" || status.llmProvider === "mock");

  return (
    <div className="space-y-4">
      {/* Status / model banner */}
      {isMock && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning-foreground dark:text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Apof.ai is in <strong>development (mock) mode</strong> — answers are extractive, not
            intelligent analysis. Configure a local model (Ollama) for grounded generation. Always
            verify against the official source.
          </span>
        </div>
      )}

      {/* Index prompt if nothing is indexed yet */}
      {status && status.counts.chunks === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <Database className="h-7 w-7 text-primary" />
            <p className="text-sm text-muted-foreground">
              {caseId
                ? "This case isn't indexed yet. Index it to enable grounded Q&A."
                : "Nothing is indexed yet. Index your cases to enable grounded Q&A."}
            </p>
            <Button onClick={runIndex} disabled={indexing}>
              {indexing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              {caseId ? "Index this case" : "Index all cases"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Question input */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-primary" />
            {caseId ? "Ask Apof.ai about this decision" : "Ask Apof.ai across all indexed decisions"}
          </div>
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ask();
            }}
            placeholder="mis. Apa pertimbangan hukum majelis hakim?"
            rows={2}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Answers cite exact evidence. ⌘/Ctrl+Enter to send.</p>
            <Button onClick={() => ask()} disabled={loading || !question.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Ask
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED.map((s) => (
              <button key={s} onClick={() => ask(s)} disabled={loading}>
                <Badge variant="outline" className="cursor-pointer hover:bg-muted">
                  {s}
                </Badge>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Answer */}
      {loading && (
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Mencari evidence &amp; menyusun jawaban…
          </CardContent>
        </Card>
      )}

      {result && !loading && <AnswerView result={result} />}
    </div>
  );
}

function AnswerView({ result }: { result: RagAnswer }) {
  if (result.notFound) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center">
          <p className="font-medium">Tidak ditemukan dalam dokumen yang tersedia.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Apof.ai belum menemukan bagian dokumen yang cukup relevan untuk pertanyaan ini.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Jawaban</h3>
          <Badge variant={CONF_VARIANT[result.confidence]}>
            <ShieldCheck className="h-3 w-3" /> Keyakinan: {result.confidence}
          </Badge>
        </div>
        <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{result.answer}</p>

        {result.simpleExplanation && (
          <>
            <Separator />
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Penjelasan sederhana
              </h4>
              <p className="text-sm text-foreground/90">{result.simpleExplanation}</p>
            </div>
          </>
        )}

        {result.citations.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Sitasi ({result.citations.length})
              </h4>
              <div className="space-y-2">
                {result.citations.map((c, i) => (
                  <div key={i} className="rounded-md border bg-muted/30 p-3">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Badge variant="outline" className="font-mono">{c.sourceId.slice(0, 14)}</Badge>
                      {c.sectionTitle && <Badge variant="primary">{c.sectionTitle}</Badge>}
                      {c.pageStart != null && <span>hal. {c.pageStart}{c.pageEnd && c.pageEnd !== c.pageStart ? `–${c.pageEnd}` : ""}</span>}
                    </div>
                    <p className="flex gap-1.5 text-sm italic text-foreground/80">
                      <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      {c.quote}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {result.evidence.length > 0 && <EvidenceList evidence={result.evidence} />}

        {result.limitations.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Keterbatasan</h4>
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {result.limitations.map((l, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-warning" /> {l}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        <p className="border-t pt-3 text-[11px] text-muted-foreground">
          AI summary may be inaccurate. Always verify with the official source.
        </p>
      </CardContent>
    </Card>
  );
}

function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-md py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
      >
        <span className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" /> Evidence yang diambil ({evidence.length})
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {evidence.map((e, i) => (
            <div key={i} className="rounded-md border p-3">
              <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <Badge variant="outline" className="font-mono">{e.sourceId.slice(0, 14)}</Badge>
                {e.sectionKind && <Badge variant="accent">{e.sectionKind}</Badge>}
                <span className={cn("ml-auto tabular")}>skor {e.score.toFixed(3)} · {e.source}</span>
              </div>
              <p className="line-clamp-4 text-xs text-foreground/75">{e.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
