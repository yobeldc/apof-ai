"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A reusable, route-pushing search input. Used in the dashboard hero and
 * anywhere a prominent entry point to /search is needed.
 */
export function GlobalSearch({
  size = "lg",
  placeholder = "Search putusan, nomor, parties, court, keywords…",
  autoFocus = false,
  className,
}: {
  size?: "md" | "lg";
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [q, setQ] = React.useState("");

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : "/search");
      }}
      className={cn("relative", className)}
    >
      <Search
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground",
          size === "lg" ? "h-5 w-5" : "h-4 w-4",
        )}
      />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus={autoFocus}
        aria-label="Search decisions"
        placeholder={placeholder}
        className={cn(
          "w-full rounded-xl border border-input bg-card/80 shadow-sm outline-none transition-all placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 backdrop-blur",
          size === "lg" ? "h-14 pl-12 pr-28 text-base" : "h-11 pl-10 pr-20 text-sm",
        )}
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded border bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground sm:flex">
        <CornerDownLeft className="h-3 w-3" /> Enter
      </kbd>
    </form>
  );
}
