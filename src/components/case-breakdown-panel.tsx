"use client";

import * as React from "react";
import {
  ListTree,
  Loader2,
  AlertTriangle,
  Scale,
  Users,
  CalendarClock,
  BookOpen,
  GraduationCap,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { fmtDate } from "@/lib/utils";

type Breakdown = {
  caseIdentity: string | null;
  proceduralHistory: string | null;
  parties: string[];
  facts: string | null;
  legalIssues: string[];
  legalBasis: string[];
  claimantArguments: string | null;
  respondentArguments: string | null;
  courtReasoning: string | null;
  finalRuling: string | null;
  ratioDecidendi: string | null;
  obiterDicta: string | null;
  legalConsequences: string | null;
  timeline: Array<{ date?: string; event: string }>;
  glossary: Array<{ term: string; simpleMeaning: string }>;
  beginnerExplanation: string | null;
  examQuestions: string[];
  limitations: string[];
  method: string;
};

export function CaseBreakdownPanel({ caseId }: { caseId: string }) {
  const [data, setData] = React.useState<Breakdown | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/cases/${caseId}/breakdown`);
        const json = await res.json();
        setData(json.breakdown);
      } finally {
        setLoading(false);
      }
    })();
  }, [caseId]);

  const generate = async (force = false) => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/breakdown`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setData(json.breakdown);
      toast.success("Breakdown generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate breakdown");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <ListTree className="h-8 w-8 text-primary" />
          <div>
            <p className="font-medium">Belum ada rincian perkara</p>
            <p className="text-sm text-muted-foreground">
              Hasilkan rincian terstruktur (deterministik) dari bagian-bagian dokumen.
            </p>
          </div>
          <Button onClick={() => generate(false)} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListTree className="h-4 w-4" />}
            Hasilkan rincian
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="capitalize">Metode: {data.method}</Badge>
        <Button variant="outline" size="sm" onClick={() => generate(true)} disabled={generating}>
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Perbarui
        </Button>
      </div>

      {data.beginnerExplanation && (
        <Section icon={BookOpen} title="Penjelasan untuk pemula">
          <p className="text-sm leading-relaxed text-foreground/90">{data.beginnerExplanation}</p>
        </Section>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field title="Identitas perkara" value={data.caseIdentity} />
        <Field title="Riwayat prosedural" value={data.proceduralHistory} />
        <Field title="Fakta" value={data.facts} />
        <Field title="Pertimbangan hukum" value={data.courtReasoning} />
        <Field title="Amar / putusan akhir" value={data.finalRuling} icon={Scale} />
        <Field title="Ratio decidendi" value={data.ratioDecidendi} />
      </div>

      {(data.parties.length > 0 || data.legalBasis.length > 0 || data.legalIssues.length > 0) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <ListSection icon={Users} title="Para pihak" items={data.parties} />
          <ListSection title="Isu hukum" items={data.legalIssues} />
          <ListSection title="Dasar hukum (pasal)" items={data.legalBasis} mono />
        </div>
      )}

      {data.timeline.length > 0 && (
        <Section icon={CalendarClock} title="Linimasa">
          <ul className="space-y-1 text-sm">
            {data.timeline.map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="tabular text-muted-foreground">{fmtDate(t.date)}</span> — {t.event}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {data.glossary.length > 0 && (
        <Section icon={BookOpen} title="Glosarium istilah hukum">
          <dl className="space-y-2">
            {data.glossary.map((g, i) => (
              <div key={i}>
                <dt className="text-sm font-medium capitalize">{g.term}</dt>
                <dd className="text-sm text-muted-foreground">{g.simpleMeaning}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {data.examQuestions.length > 0 && (
        <Section icon={GraduationCap} title="Pertanyaan latihan">
          <ul className="list-disc space-y-1 pl-5 text-sm text-foreground/90">
            {data.examQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </Section>
      )}

      {data.limitations.length > 0 && (
        <Section icon={AlertTriangle} title="Keterbatasan">
          <ul className="space-y-1 text-xs text-muted-foreground">
            {data.limitations.map((l, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-warning" /> {l}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <p className="text-[11px] text-muted-foreground">
        Rincian deterministik dari bagian dokumen — tidak mengarang. AI summary may be inaccurate.
        Always verify with the official source.
      </p>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Icon className="h-4 w-4" /> {title}
        </h3>
        {children}
      </CardContent>
    </Card>
  );
}

function Field({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string | null;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {Icon && <Icon className="h-4 w-4" />} {title}
        </h3>
        {value ? (
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{value}</p>
        ) : (
          <p className="text-sm italic text-muted-foreground">Tidak terdeteksi dalam dokumen.</p>
        )}
      </CardContent>
    </Card>
  );
}

function ListSection({
  icon: Icon,
  title,
  items,
  mono,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  items: string[];
  mono?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {Icon && <Icon className="h-4 w-4" />} {title}
        </h3>
        {items.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">—</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {items.map((it, i) => (
              <Badge key={i} variant="outline" className={mono ? "font-mono" : undefined}>
                {it}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
