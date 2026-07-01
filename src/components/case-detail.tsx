"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FileText,
  Scale,
  Users,
  Gavel,
  ListTree,
  Sparkles,
  StickyNote,
  CalendarClock,
  LayoutGrid,
  ExternalLink,
  AlertTriangle,
  Plus,
  Trash2,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import type { ClientCase, ClientNote } from "@/lib/case";
import type { CaseSummary } from "@/lib/summarize";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { DataQualityBadge } from "@/components/data-quality-badge";
import { SourceLinkButton } from "@/components/source-link-button";
import { SaveCaseButton } from "@/components/save-case-button";
import { AskApofPanel } from "@/components/ask-apof-panel";
import { CaseBreakdownPanel } from "@/components/case-breakdown-panel";
import { usePrivacy } from "@/components/privacy-provider";
import { fmtDate, orDash } from "@/lib/utils";

type SimilarCase = {
  id: string;
  nomorPutusan: string | null;
  pengadilan: string | null;
  klasifikasi: string | null;
  tahun: number | null;
};

const SENSITIVE = ["anak", "agama", "asusila", "kdrt"];

export function CaseDetail({
  case: c,
  notes: initialNotes,
  similar,
}: {
  case: ClientCase;
  notes: ClientNote[];
  similar: SimilarCase[];
}) {
  const sensitive = SENSITIVE.some((s) => (c.klasifikasi ?? "").toLowerCase().includes(s));

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }}>
        <Link href="/search" className="mb-3 inline-flex text-sm text-muted-foreground hover:text-foreground">
          ← Back to search
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {c.isDemo && <Badge variant="outline">Demo</Badge>}
              {c.tingkatProses && <Badge variant="primary">{c.tingkatProses}</Badge>}
              {c.klasifikasi && <Badge variant="accent">{c.klasifikasi}</Badge>}
              {sensitive && (
                <Badge variant="warning">
                  <ShieldAlert className="h-3 w-3" /> Sensitive category
                </Badge>
              )}
            </div>
            <h1 className="mt-2 font-mono text-xl font-semibold tracking-tight sm:text-2xl">
              {orDash(c.nomorPutusan)}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {orDash(c.pengadilan ?? c.lembagaPeradilan)} · {orDash(c.tahun)}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <DataQualityBadge status={c.extractionStatus} />
            <SaveCaseButton caseId={c.id} initialSaved={c.isSaved} variant="outline" withLabel />
            {c.hasPdf && c.pdfUrl && (
              <Button asChild variant="outline" size="sm">
                <a href={c.pdfUrl} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-4 w-4" /> PDF
                </a>
              </Button>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-1.5 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
          <span>
            Not an official Mahkamah Agung product. Source:{" "}
            <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-medium text-foreground/80 hover:underline">
              {c.sourceDomain} <ExternalLink className="h-3 w-3" />
            </a>
          </span>
        </div>

        {c.extractionStatus === "partial" && (
          <div className="mt-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground dark:text-warning">
            Some fields could not be parsed automatically. View the source to verify.
          </div>
        )}
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="mt-6">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview"><LayoutGrid className="h-4 w-4" /> Overview</TabsTrigger>
          <TabsTrigger value="ask"><Sparkles className="h-4 w-4" /> Ask Apof.ai</TabsTrigger>
          <TabsTrigger value="breakdown"><ListTree className="h-4 w-4" /> Breakdown</TabsTrigger>
          <TabsTrigger value="timeline"><CalendarClock className="h-4 w-4" /> Timeline</TabsTrigger>
          <TabsTrigger value="parties"><Users className="h-4 w-4" /> Parties</TabsTrigger>
          <TabsTrigger value="judges"><Gavel className="h-4 w-4" /> Judges & Court</TabsTrigger>
          <TabsTrigger value="amar"><Scale className="h-4 w-4" /> Amar</TabsTrigger>
          <TabsTrigger value="fulltext"><FileText className="h-4 w-4" /> Full Text</TabsTrigger>
          <TabsTrigger value="pdf"><FileText className="h-4 w-4" /> PDF</TabsTrigger>
          <TabsTrigger value="ai"><Sparkles className="h-4 w-4" /> AI Summary</TabsTrigger>
          <TabsTrigger value="notes"><StickyNote className="h-4 w-4" /> Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab c={c} similar={similar} />
        </TabsContent>
        <TabsContent value="ask">
          <AskApofPanel caseId={c.id} />
        </TabsContent>
        <TabsContent value="breakdown">
          <CaseBreakdownPanel caseId={c.id} />
        </TabsContent>
        <TabsContent value="timeline">
          <TimelineTab c={c} />
        </TabsContent>
        <TabsContent value="parties">
          <PartiesTab c={c} />
        </TabsContent>
        <TabsContent value="judges">
          <JudgesTab c={c} />
        </TabsContent>
        <TabsContent value="amar">
          <Card>
            <CardContent className="p-6">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <Scale className="h-4 w-4" /> Amar Putusan
              </h2>
              <p className="prose-legal whitespace-pre-line">{c.amarPutusan ?? "Amar tidak terbaca dari sumber."}</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="fulltext">
          <FullTextTab c={c} />
        </TabsContent>
        <TabsContent value="pdf">
          <PdfTab c={c} />
        </TabsContent>
        <TabsContent value="ai">
          <AiSummaryTab c={c} />
        </TabsContent>
        <TabsContent value="notes">
          <NotesTab caseId={c.id} initialNotes={initialNotes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-sm" : "text-sm text-foreground/90"}>{value}</dd>
    </div>
  );
}

function OverviewTab({ c, similar }: { c: ClientCase; similar: SimilarCase[] }) {
  const { transform } = usePrivacy();
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-5 p-6 md:grid-cols-3">
          <Field label="Nomor Putusan" value={orDash(c.nomorPutusan)} mono />
          <Field label="Court" value={orDash(c.pengadilan ?? c.lembagaPeradilan)} />
          <Field label="Process level" value={orDash(c.tingkatProses)} />
          <Field label="Klasifikasi" value={orDash(c.klasifikasi)} />
          <Field label="Year" value={orDash(c.tahun)} />
          <Field label="Province" value={orDash(c.provinsi)} />
          <Field label="Tanggal Register" value={fmtDate(c.tanggalRegister)} />
          <Field label="Tanggal Musyawarah" value={fmtDate(c.tanggalMusyawarah)} />
          <Field label="Tanggal Putusan" value={fmtDate(c.tanggalPutusan)} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amar</h3>
          <p className="text-sm leading-relaxed text-foreground/90">{orDash(c.amarPutusan ?? c.ringkasanSingkat)}</p>
        </CardContent>
      </Card>

      {c.pihak.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Parties</h3>
            <div className="flex flex-wrap gap-2">
              {c.pihak.map((p, i) => (
                <Badge key={i} variant="outline">{transform(p)}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {c.kataKunci.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kata Kunci</h3>
            <div className="flex flex-wrap gap-2">
              {c.kataKunci.map((k, i) => (
                <Badge key={i} variant="primary">{k}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {similar.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Similar cases</h3>
            <div className="space-y-1">
              {similar.map((s) => (
                <Link key={s.id} href={`/cases/${s.id}`} className="flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-muted">
                  <span className="truncate font-mono">{orDash(s.nomorPutusan)}</span>
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">{orDash(s.pengadilan)} · {orDash(s.tahun)}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TimelineTab({ c }: { c: ClientCase }) {
  const events = [
    { date: c.tanggalRegister, label: "Register perkara", desc: "Perkara terdaftar di pengadilan." },
    { date: c.tanggalMusyawarah, label: "Musyawarah majelis", desc: "Majelis hakim bermusyawarah." },
    { date: c.tanggalPutusan, label: "Putusan dibacakan", desc: "Putusan diucapkan dalam sidang." },
  ].filter((e) => e.date);

  if (!events.length) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">No dated events available.</CardContent></Card>;
  }
  return (
    <Card>
      <CardContent className="p-6">
        <ol className="relative ml-3 space-y-6 border-l border-border">
          {events.map((e, i) => (
            <li key={i} className="ml-6">
              <span className="absolute -left-[7px] mt-1.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-primary" />
              <time className="text-xs font-medium uppercase tracking-wide text-muted-foreground tabular">{fmtDate(e.date)}</time>
              <p className="mt-0.5 font-medium text-foreground">{e.label}</p>
              <p className="text-sm text-muted-foreground">{e.desc}</p>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function PartiesTab({ c }: { c: ClientCase }) {
  const { transform, redact, hideNames } = usePrivacy();
  const rows = [
    ["Pemohon", c.pemohon],
    ["Termohon", c.termohon],
    ["Penggugat", c.penggugat],
    ["Tergugat", c.tergugat],
    ["Terdakwa", c.terdakwa],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        {(redact || hideNames) && (
          <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground dark:text-warning">
            Privacy mode active — party names are {hideNames ? "hidden" : "redacted"} in this view.
          </div>
        )}
        {rows.length === 0 && c.pihak.length === 0 ? (
          <p className="text-sm text-muted-foreground">No party details parsed.</p>
        ) : (
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {rows.map(([label, v]) => (
              <Field key={label} label={label} value={transform(v)} />
            ))}
          </dl>
        )}
        {c.pihak.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">All parties</p>
              <div className="flex flex-wrap gap-2">
                {c.pihak.map((p, i) => (
                  <Badge key={i} variant="outline">{transform(p)}</Badge>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function JudgesTab({ c }: { c: ClientCase }) {
  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Lembaga Peradilan" value={orDash(c.lembagaPeradilan)} />
          <Field label="Jenis Lembaga Peradilan" value={orDash(c.jenisLembagaPeradilan)} />
          <Field label="Pengadilan" value={orDash(c.pengadilan)} />
          <Field label="Provinsi" value={orDash(c.provinsi)} />
          <Field label="Panitera" value={orDash(c.panitera)} />
        </dl>
        <Separator />
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Gavel className="h-3.5 w-3.5" /> Majelis Hakim
          </p>
          {c.hakim.length ? (
            <ul className="space-y-1.5">
              {c.hakim.map((h, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                    {i + 1}
                  </span>
                  {h}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No judges parsed.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FullTextTab({ c }: { c: ClientCase }) {
  if (!c.fullText) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Full text not available. <SourceLinkButton url={c.sourceUrl} label="Open source" />
        </CardContent>
      </Card>
    );
  }
  // Emphasize section headings.
  const html = c.fullText
    .replace(/\b(MENGADILI|MENIMBANG|MENGINGAT|AMAR PUTUSAN|DEMI KEADILAN[^\n]*)\b/g, "\n\n§§$1§§\n");
  const blocks = html.split("\n\n").map((b) => b.trim()).filter(Boolean);

  return (
    <Card>
      <CardContent className="p-6 md:p-8">
        <div className="prose-legal mx-auto">
          {blocks.map((b, i) => {
            const m = b.match(/^§§(.+)§§$/);
            if (m) return <h3 key={i} className="mt-6 font-sans text-sm font-bold uppercase tracking-wider text-primary">{m[1]}</h3>;
            return <p key={i} className="whitespace-pre-line">{b}</p>;
          })}
        </div>
        <Separator className="my-6" />
        <p className="text-xs text-muted-foreground">
          Parsed from the source page — <SourceLinkButton url={c.sourceUrl} label="verify against original" />
        </p>
      </CardContent>
    </Card>
  );
}

function PdfTab({ c }: { c: ClientCase }) {
  // Prefer a locally-imported PDF (servable); else the original external URL.
  const src = c.localPdfUrl ?? c.pdfUrl;
  const isLocal = !!c.localPdfUrl;
  if (!src) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          No PDF found for this decision. The original page may still host one —{" "}
          <SourceLinkButton url={c.sourceUrl} label="check source" />
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {isLocal ? "Imported PDF (stored locally)" : "Original PDF document"}
          </p>
          <Button asChild variant="outline" size="sm">
            <a href={src} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" /> {isLocal ? "Open / download" : "Open original"}
            </a>
          </Button>
        </div>
        <iframe src={src} title="Decision PDF" className="h-[70vh] w-full rounded-md border" />
      </CardContent>
    </Card>
  );
}

function AiSummaryTab({ c }: { c: ClientCase }) {
  const [summary, setSummary] = React.useState<CaseSummary | null>(c.aiSummaryJson);
  const [loading, setLoading] = React.useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: c.id }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setSummary(data.summary);
      toast.success("Summary generated");
    } catch {
      toast.error("Could not generate summary");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning-foreground dark:text-warning">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>AI summary may be inaccurate. Always verify with the official source.</span>
      </div>

      {!summary ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <Sparkles className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium">No summary yet</p>
              <p className="text-sm text-muted-foreground">Generate an Indonesian summary, legal issues, outcome, and timeline.</p>
            </div>
            <Button onClick={generate} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate summary
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Ringkasan</h3>
                <Badge variant="outline">{summary.method === "llm" ? "LLM" : "Deterministic"}</Badge>
              </div>
              <p className="text-sm leading-relaxed text-foreground/90">{summary.ringkasan}</p>
              <Separator />
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outcome</h4>
                <p className="text-sm text-foreground/90">{summary.outcome}</p>
              </div>
              {summary.legalIssues.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Legal issues</h4>
                  <ul className="space-y-1">
                    {summary.legalIssues.map((it, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <ListTree className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" /> {it}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {summary.timeline.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Timeline</h4>
                  <ul className="space-y-1 text-sm">
                    {summary.timeline.map((t, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="tabular text-muted-foreground">{fmtDate(t.date)}</span> — {t.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
          <Button variant="outline" size="sm" onClick={generate} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Regenerate
          </Button>
        </>
      )}
    </div>
  );
}

function NotesTab({ caseId, initialNotes }: { caseId: string; initialNotes: ClientNote[] }) {
  const [notes, setNotes] = React.useState(initialNotes);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const add = async () => {
    if (!body.trim() && !title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          title: title.trim() || undefined,
          body,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      setNotes((n) => [
        { id: data.note.id, title: data.note.title, body: data.note.body, tags: tags.split(",").map((t) => t.trim()).filter(Boolean), updatedAt: new Date().toISOString() },
        ...n,
      ]);
      setTitle("");
      setBody("");
      setTags("");
      toast.success("Note saved");
    } catch {
      toast.error("Could not save note");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setNotes((n) => n.filter((x) => x.id !== id));
    await fetch(`/api/notes?id=${id}`, { method: "DELETE" }).catch(() => {});
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-5">
          <Input placeholder="Note title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Your research notes…" value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
          <Input placeholder="Tags (comma separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
          <div className="flex justify-end">
            <Button onClick={add} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add note
            </Button>
          </div>
        </CardContent>
      </Card>

      {notes.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        notes.map((n) => (
          <Card key={n.id}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {n.title && <p className="font-medium">{n.title}</p>}
                  <p className="mt-1 whitespace-pre-line text-sm text-foreground/90">{n.body}</p>
                  {n.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {n.tags.map((t, i) => (
                        <Badge key={i} variant="outline">#{t}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => remove(n.id)} aria-label="Delete note">
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
