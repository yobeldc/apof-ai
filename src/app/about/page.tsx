import { Scale, ExternalLink, ShieldAlert, Database, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "About — Apof.ai" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Scale className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Apof.ai</h1>
          <p className="text-sm text-muted-foreground">A personal legal research interface.</p>
        </div>
      </div>

      <Card className="border-warning/40 bg-warning/5">
        <CardContent className="flex items-start gap-3 p-5">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold">Not an official Mahkamah Agung product.</p>
            <p className="text-muted-foreground">
              This is an independent, personal research tool. It caches and re-presents public court
              decisions for convenience. It is not affiliated with, endorsed by, or representative of
              the Supreme Court of Indonesia.
            </p>
          </div>
        </CardContent>
      </Card>

      <Section icon={Database} title="Source of truth">
        Every decision originates from{" "}
        <a href="https://putusan3.mahkamahagung.go.id/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline">
          putusan3.mahkamahagung.go.id <ExternalLink className="h-3 w-3" />
        </a>
        . The original source link is preserved on every case and is always one click away. When in
        doubt, the official site is authoritative — this app may contain parsing errors.
      </Section>

      <Section icon={Scale} title="Polite by design">
        Ingestion runs with concurrency 1, randomized 8–20 second delays, exponential backoff, and
        respect for robots.txt. It does not bypass CAPTCHAs, anti-bot systems, rate limits, or access
        controls, and it uses no stealth or proxy rotation. It identifies itself with an honest
        User-Agent. Please keep it that way.
      </Section>

      <Section icon={Sparkles} title="AI summaries">
        Optional AI summaries are generated to aid research. They may be inaccurate or incomplete —
        <span className="font-medium text-foreground"> always verify with the official source</span>.
        The summarizer is deterministic by default and only calls an external LLM if you explicitly
        enable it.
      </Section>

      <Section icon={ShieldAlert} title="Privacy">
        Court decisions can contain sensitive personal information. This app intentionally avoids a
        “search by person” focus, flags sensitive categories, and offers redaction/hide-names modes in
        Settings. Use it responsibly and lawfully.
      </Section>

      <p className="pt-2 text-center text-xs text-muted-foreground">
        Local-first · cache-first · personal research use only.
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
    <div>
      <h2 className="mb-1.5 flex items-center gap-2 font-semibold">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}
