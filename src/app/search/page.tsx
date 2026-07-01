import { Suspense } from "react";
import { SearchView } from "@/components/search-view";

export const metadata = { title: "Search — Apof.ai" };

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading search…</div>}>
      <SearchView />
    </Suspense>
  );
}
