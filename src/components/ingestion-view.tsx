"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Compass,
  FileUp,
  ClipboardPaste,
  LinkIcon,
  RotateCcw,
  Play,
  Square,
  Loader2,
  ShieldCheck,
  FolderUp,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { FileImportPanel } from "@/components/file-import-panel";
import { cn } from "@/lib/utils";

type Job = {
  id: string;
  mode: string;
  status: string;
  progressTotal: number;
  progressDone: number;
  progressFailed: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};
type Queue = { pending: number; processing: number; completed: number; failed: number; skipped: number };

const MODES = [
  { id: "import", label: "Import files", icon: FolderUp },
  { id: "seed", label: "Seed Explorer", icon: Compass },
  { id: "csv", label: "Import CSV/TXT", icon: FileUp },
  { id: "paste", label: "Paste URLs", icon: ClipboardPaste },
  { id: "single", label: "Single URL", icon: LinkIcon },
  { id: "reingest", label: "Re-ingest failed", icon: RotateCcw },
] as const;

export function IngestionView() {
  const [mode, setMode] = React.useState<(typeof MODES)[number]["id"]>("import");
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [queue, setQueue] = React.useState<Queue>({ pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0 });

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/ingestion/jobs");
      const data = await res.json();
      setJobs(data.jobs);
      setQueue(data.queue);
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ingestion</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Build your local index from the official public site — slowly and politely.
        </p>
      </div>

      {/* Ethical banner */}
      <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div className="text-sm">
          <p className="font-semibold text-warning-foreground dark:text-warning">
            Use polite ingestion. Do not overload the public court system.
          </p>
          <p className="mt-1 text-muted-foreground">
            Defaults: concurrency 1 · randomized 8–20s delay · exponential backoff on errors · respects robots.txt.
            Mahkamah Agung is the source of truth — this is only a personal cache.
          </p>
        </div>
      </div>

      {/* Queue health bento */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <QueueTile label="Pending" value={queue.pending} accent="muted" />
        <QueueTile label="Processing" value={queue.processing} accent="accent" />
        <QueueTile label="Completed" value={queue.completed} accent="success" />
        <QueueTile label="Failed" value={queue.failed} accent="destructive" />
        <QueueTile label="Skipped" value={queue.skipped} accent="muted" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Mode selector + form */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Start a run</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {MODES.map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setMode(m.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                        mode === m.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" /> {m.label}
                    </button>
                  );
                })}
              </div>
              {mode === "import" ? (
                <FileImportPanel onDone={refresh} />
              ) : (
                <IngestionForm mode={mode} onStarted={refresh} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Job list */}
        <div className="space-y-3 lg:col-span-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Recent jobs</h2>
          {jobs.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No ingestion runs yet. The app is fully usable on demo data first.
              </CardContent>
            </Card>
          ) : (
            jobs.map((j) => <JobProgressCard key={j.id} job={j} onChange={refresh} />)
          )}
        </div>
      </div>
    </div>
  );
}

function QueueTile({ label, value, accent }: { label: string; value: number; accent: "muted" | "accent" | "success" | "destructive" }) {
  const color = {
    muted: "text-muted-foreground",
    accent: "text-accent",
    success: "text-success",
    destructive: "text-destructive",
  }[accent];
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular", color)}>{value.toLocaleString()}</p>
    </div>
  );
}

function IngestionForm({ mode, onStarted }: { mode: string; onStarted: () => void }) {
  const [seedUrl, setSeedUrl] = React.useState("https://putusan3.mahkamahagung.go.id/direktori.html");
  const [seedSize, setSeedSize] = React.useState<"small" | "medium" | "large">("small");
  const [dryRun, setDryRun] = React.useState(false);
  const [text, setText] = React.useState("");
  const [single, setSingle] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const submit = async () => {
    setSubmitting(true);
    const config: Record<string, unknown> = { dryRun };
    if (mode === "seed") {
      config.seedUrl = seedUrl;
      config.seedSize = seedSize;
    } else if (mode === "single") {
      config.urls = [single];
    } else if (mode === "csv" || mode === "paste") {
      config.rawText = text;
    }
    try {
      const res = await fetch("/api/ingestion/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, config }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success(mode === "reingest" ? "Re-ingestion started" : "Ingestion job started");
      setText("");
      setSingle("");
      onStarted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start job");
    } finally {
      setSubmitting(false);
    }
  };

  const onFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-warning/10 px-3 py-2 text-xs text-muted-foreground">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
        <span>
          Heads-up: the live site currently returns <span className="font-medium text-foreground">403</span> to
          automated clients, so these network modes will back off without fetching. For real data, use{" "}
          <span className="font-medium text-foreground">Import files</span> (saved from your own browser).
        </span>
      </div>
      {mode === "seed" && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="seedUrl">Seed listing / directory / category URL</Label>
            <Input id="seedUrl" value={seedUrl} onChange={(e) => setSeedUrl(e.target.value)} />
            <p className="text-xs text-muted-foreground">Must be on putusan3.mahkamahagung.go.id. The explorer walks pagination slowly and collects decision links.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Run size</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: "small", label: "Small", desc: "≤ 100 URLs" },
                { id: "medium", label: "Medium", desc: "≤ 1,000 URLs" },
                { id: "large", label: "Large", desc: "≤ 10,000 · very slow" },
              ] as const).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSeedSize(s.id)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    seedSize === s.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted",
                  )}
                >
                  <p className="text-sm font-medium">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {(mode === "csv" || mode === "paste") && (
        <div className="space-y-1.5">
          <Label htmlFor="urls">{mode === "csv" ? "Upload a CSV/TXT of URLs (one per line)" : "Paste many URLs"}</Label>
          {mode === "csv" && (
            <input
              type="file"
              accept=".csv,.txt"
              onChange={(e) => onFile(e.target.files?.[0])}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
          )}
          <Textarea id="urls" value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="https://putusan3.mahkamahagung.go.id/direktori/putusan/…" className="font-mono text-xs" />
          <p className="text-xs text-muted-foreground">URLs outside the allowed source are ignored automatically.</p>
        </div>
      )}

      {mode === "single" && (
        <div className="space-y-1.5">
          <Label htmlFor="single">Decision URL</Label>
          <Input id="single" value={single} onChange={(e) => setSingle(e.target.value)} placeholder="https://putusan3.mahkamahagung.go.id/direktori/putusan/…" className="font-mono text-xs" />
        </div>
      )}

      {mode === "reingest" && (
        <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          Re-queues every URL currently in the <span className="font-medium text-foreground">failed</span> state and retries them with backoff.
        </div>
      )}

      <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
        <Label htmlFor="dryRun" className="flex items-center gap-2 text-sm">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" /> Dry run (discover URLs only, no detail fetch)
        </Label>
        <Switch id="dryRun" checked={dryRun} onCheckedChange={setDryRun} />
      </div>

      <Button onClick={submit} disabled={submitting} className="w-full">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        {mode === "reingest" ? "Re-ingest failed URLs" : "Start ingestion"}
      </Button>
    </div>
  );
}

function JobProgressCard({ job, onChange }: { job: Job; onChange: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const pct = job.progressTotal > 0 ? Math.round((job.progressDone / job.progressTotal) * 100) : 0;
  const running = job.status === "processing" || job.status === "pending";

  const act = async (action: "stop" | "resume") => {
    setBusy(true);
    try {
      await fetch(`/api/ingestion/jobs/${job.id}/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      onChange();
    } finally {
      setBusy(false);
    }
  };

  const statusVariant =
    job.status === "completed" ? "success"
    : job.status === "processing" ? "accent"
    : job.status === "failed" ? "destructive"
    : job.status === "paused" || job.status === "stopped" ? "warning"
    : "outline";

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="capitalize">{job.mode}</Badge>
          <Badge variant={statusVariant as any} className="capitalize">{job.status}</Badge>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground tabular">
          <span>{job.progressDone} done</span>
          <span className="text-destructive">{job.progressFailed} failed</span>
          <span>{job.progressTotal} total</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/ingestion/jobs/${job.id}`}>Logs</Link>
          </Button>
          {running ? (
            <Button variant="outline" size="sm" onClick={() => act("stop")} disabled={busy}>
              <Square className="h-3.5 w-3.5" /> Stop
            </Button>
          ) : job.status === "stopped" || job.status === "paused" ? (
            <Button variant="outline" size="sm" onClick={() => act("resume")} disabled={busy}>
              <Play className="h-3.5 w-3.5" /> Resume
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
