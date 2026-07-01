"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Command as CommandIcon, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { PrivacyToggle } from "@/components/privacy-toggle";

/** Top bar: global quick-search entry + command palette trigger + toggles. */
export function TopCommandBar() {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const openPalette = () => window.dispatchEvent(new CustomEvent("command-palette:open"));

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md md:px-6">
      <form
        className="relative flex max-w-xl flex-1 items-center"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : "/search");
        }}
      >
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
        <input
          id="global-search-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search putusan, nomor, parties, court…"
          aria-label="Search decisions"
          className="h-9 w-full rounded-md border border-input bg-muted/40 pl-9 pr-16 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        />
        <kbd className="pointer-events-none absolute right-2.5 hidden rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
          /
        </kbd>
      </form>

      <div className="ml-auto flex items-center gap-1.5">
        <Button variant="outline" size="sm" className="hidden gap-2 sm:flex" onClick={openPalette}>
          <CommandIcon className="h-3.5 w-3.5" />
          <span className="text-xs text-muted-foreground">Command</span>
          <kbd className="rounded border bg-muted px-1.5 font-mono text-[10px]">⌘K</kbd>
        </Button>
        <PrivacyToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}
