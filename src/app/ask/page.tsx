import { Sparkles } from "lucide-react";
import { AskApofPanel } from "@/components/ask-apof-panel";

export const metadata = { title: "Ask — Apof.ai" };

export default function AskPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Sparkles className="h-6 w-6 text-primary" /> Ask Apof.ai
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Grounded, citation-first Q&amp;A across all your indexed Indonesian court decisions.
          Answers come only from your stored documents.
        </p>
      </div>
      <AskApofPanel />
    </div>
  );
}
