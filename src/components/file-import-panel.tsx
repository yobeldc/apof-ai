"use client";

import * as React from "react";
import { UploadCloud, FileText, FileCode, Loader2, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type ImportResult = {
  outcome: "imported" | "skipped" | "failed";
  filename: string;
  nomorPutusan?: string | null;
  extractionStatus?: string;
  error?: string;
};

/**
 * Drag-and-drop offline import. The user saves decision pages (.html) or PDFs
 * from their OWN browser (the live site 403s automated clients) and drops them
 * here. Uploads to /api/ingestion/import, which parses locally — no scraping.
 */
export function FileImportPanel({ onDone }: { onDone?: () => void }) {
  const [dragging, setDragging] = React.useState(false);
  const [files, setFiles] = React.useState<File[]>([]);
  const [force, setForce] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [results, setResults] = React.useState<ImportResult[] | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const accepted = Array.from(list).filter((f) => /\.(html?|pdf)$/i.test(f.name) || f.type === "application/pdf" || f.type === "text/html");
    if (accepted.length === 0) {
      toast.error("Only .html and .pdf files are supported");
      return;
    }
    setFiles((prev) => {
      const seen = new Set(prev.map((p) => p.name + p.size));
      return [...prev, ...accepted.filter((f) => !seen.has(f.name + f.size))];
    });
  };

  const upload = async () => {
    if (files.length === 0) return;
    setBusy(true);
    setResults(null);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      fd.append("force", String(force));
      const res = await fetch("/api/ingestion/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResults(data.results);
      toast.success(`Imported ${data.summary.imported} · skipped ${data.summary.skipped} · failed ${data.summary.failed}`);
      setFiles([]);
      onDone?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
        The live site blocks automated fetching (403). This imports decisions you saved from your{" "}
        <span className="font-medium text-foreground">own browser</span> — zero network requests, nothing bypassed.
        Save a decision page as <span className="font-mono">Webpage, HTML Only</span> and/or download its PDF, then drop the files here.
      </div>

      {/* Dropzone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-border hover:border-ring/60 hover:bg-muted/40",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".html,.htm,.pdf"
          multiple
          className="sr-only"
          onChange={(e) => addFiles(e.target.files)}
        />
        <UploadCloud className={cn("h-9 w-9", dragging ? "text-primary" : "text-muted-foreground")} />
        <p className="mt-3 text-sm font-medium">Drop saved decision files here</p>
        <p className="mt-0.5 text-xs text-muted-foreground">.html and .pdf · or click to browse</p>
      </div>

      {/* Selected files */}
      {files.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">{files.length} file(s) ready</p>
          <ul className="max-h-40 space-y-1 overflow-y-auto scroll-thin rounded-md border p-2">
            {files.map((f, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  {/\.pdf$/i.test(f.name) ? <FileText className="h-4 w-4 shrink-0 text-accent" /> : <FileCode className="h-4 w-4 shrink-0 text-primary" />}
                  <span className="truncate">{f.name}</span>
                </span>
                <button
                  onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="shrink-0 cursor-pointer text-xs text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${f.name}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
        <Label htmlFor="forceImport" className="text-sm">
          Re-import if already in index (overwrite)
        </Label>
        <Switch id="forceImport" checked={force} onCheckedChange={setForce} />
      </div>

      <Button onClick={upload} disabled={busy || files.length === 0} className="w-full">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
        Import {files.length > 0 ? `${files.length} file(s)` : "files"}
      </Button>

      {/* Results */}
      {results && (
        <ul className="space-y-1 rounded-md border p-2 text-sm">
          {results.map((r, i) => (
            <li key={i} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                {r.outcome === "imported" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                ) : r.outcome === "skipped" ? (
                  <MinusCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                )}
                <span className="truncate">{r.nomorPutusan || r.filename}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {r.outcome === "failed" ? r.error : r.outcome === "imported" ? r.extractionStatus : "already indexed"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
