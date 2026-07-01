import Link from "next/link";
import { Bookmark } from "lucide-react";
import { search } from "@/lib/search";
import { CaseResultCard } from "@/components/case-result-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Saved — Apof.ai" };

export default async function SavedPage() {
  const results = await search({ savedOnly: true, pageSize: 50, sort: "recent" });

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Bookmark className="h-6 w-6 text-primary" /> Saved cases
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{results.total} saved decision(s) in your collections.</p>
      </div>

      {results.hits.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="Nothing saved yet"
          description="Bookmark decisions from search or a case page to build your personal research library."
          action={
            <Button asChild>
              <Link href="/search">Browse decisions</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {results.hits.map((hit, i) => (
            <CaseResultCard key={hit.id} hit={hit} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
