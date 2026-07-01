"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Square, Play, Loader2, Pause } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataQualityBadge } from "@/components/data-quality-badge";
import { cn } from "@/lib/utils";

type LogLine = { ts: string; level: "info" | "warn" | "error"; msg: string };
type JobDetail = {
  job: {
    id: string;
    mode: string;
    status: string;
    configJson: string;
    progressTotal: number;
    progressDone: number;
    progressFailed: number;
    startedAt: string | null;
    finishedAt: string | null;
    logs: LogLine[];
  };
  urls: {
    id: string;
    url: string;
    status: string;
    attemptCount: number;
    errorMessage: string | null;
  }[];
  running: boolean;
};

export function JobLogsView({ jobId }: { jobId: string }) {
  const [data, setData] = React.useState<JobDetail | null>(null);
  const [autoscroll, setAutoscroll] = React.useState(true);
  const logRef = React.useRef<HTMLDivElement>(null);

  const refresh = React.useCallback(async () => {
    const res = await fetch(`/api/ingestion/jobs/${jobId}`);
    if (res.ok) setData(await res.json());
  }, [jobId]);

  React.useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  React.useEffect(() => {
    if (autoscroll && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [data, autoscroll]);

  const act = async (action: "stop" | "resume") => {
    await fetch(`/api/ingestion/jobs/${jobId}/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    refresh();
  };

  if (!data) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading job…
      </div>
    );
  }

  const { job } = data;
  const pct = job.progressTotal > 0 ? Math.round((job.progressDone / job.progressTotal) * 100) : 0;
  const config = JSON.parse(job.configJson || "{}");
  const running = job.status === "processing" || job.status === "pending";

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
      <Link href="/ingestion" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to ingestion
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Badge variant="outline" className="capitalize">{job.mode}</Badge>
            Job <span className="font-mono text-sm text-muted-foreground">{job.id.slice(0, 8)}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {running ? (
            <Button variant="outline" size="sm" onClick={() => act("stop")}>
              <Square className="h-3.5 w-3.5" /> Stop job
            </Button>
          ) : (job.status === "stopped" || job.status === "paused") ? (
            <Button variant="outline" size="sm" onClick={() => act("resume")}>
              <Play className="h-3.5 w-3.5" /> Resume
            </Button>
          ) : null}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Status" value={<span className="capitalize">{job.status}</span>} />
        <Stat label="Progress" value={`${pct}%`} />
        <Stat label="Done / Failed" value={`${job.progressDone} / ${job.progressFailed}`} />
        <Stat label="Total" value={job.progressTotal} />
      </div>

      {/* Config snapshot */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Config snapshot</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md bg-muted/50 p-3 text-xs scroll-thin">{JSON.stringify(config, null, 2)}</pre>
        </CardContent>
      </Card>

      {/* Log console */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm">Log console</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setAutoscroll((v) => !v)}>
            <Pause className="h-3.5 w-3.5" /> {autoscroll ? "Pause autoscroll" : "Resume autoscroll"}
          </Button>
        </CardHeader>
        <CardContent>
          <div ref={logRef} className="h-72 overflow-y-auto rounded-md border bg-[hsl(224_30%_7%)] p-3 font-mono text-xs scroll-thin">
            {job.logs.length === 0 ? (
              <p className="text-slate-500">No log output yet…</p>
            ) : (
              job.logs.map((l, i) => (
                <div key={i} className="flex gap-2 py-0.5">
                  <span className="shrink-0 text-slate-500">{new Date(l.ts).toLocaleTimeString()}</span>
                  <span
                    className={cn(
                      "shrink-0 uppercase",
                      l.level === "error" ? "text-red-400" : l.level === "warn" ? "text-amber-400" : "text-sky-400",
                    )}
                  >
                    {l.level}
                  </span>
                  <span className="text-slate-200">{l.msg}</span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Discovered URLs */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Discovered URLs ({data.urls.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {data.urls.length === 0 ? (
            <p className="text-sm text-muted-foreground">No URLs recorded for this job yet.</p>
          ) : (
            <div className="divide-y">
              {data.urls.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-3 py-2">
                  <a href={u.url} target="_blank" rel="noopener noreferrer" className="truncate font-mono text-xs text-muted-foreground hover:text-foreground hover:underline">
                    {u.url}
                  </a>
                  <div className="flex shrink-0 items-center gap-2">
                    {u.errorMessage && <span className="hidden text-xs text-destructive sm:inline">{u.errorMessage.slice(0, 40)}</span>}
                    <DataQualityBadge status={u.status === "completed" ? "complete" : u.status === "failed" ? "failed" : "pending"} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular">{value}</p>
    </div>
  );
}
