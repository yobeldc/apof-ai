"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  Search,
  Sparkles,
  LayoutDashboard,
  Database,
  Bookmark,
  FolderOpen,
  Settings,
  Info,
  Moon,
  Sun,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { usePrivacy } from "@/components/privacy-provider";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, hint: "Overview" },
  { label: "Search decisions", href: "/search", icon: Search, hint: "Find putusan" },
  { label: "Ask Apof.ai", href: "/ask", icon: Sparkles, hint: "Grounded Q&A" },
  { label: "Ingestion", href: "/ingestion", icon: Database, hint: "Import data" },
  { label: "Saved cases", href: "/saved", icon: Bookmark, hint: "Bookmarks" },
  { label: "Collections", href: "/collections", icon: FolderOpen, hint: "Research sets" },
  { label: "Settings", href: "/settings", icon: Settings, hint: "Preferences" },
  { label: "About & disclaimer", href: "/about", icon: Info, hint: "Source info" },
];

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const { redact, setRedact } = usePrivacy();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      // "/" focuses search when not typing in a field
      if (e.key === "/" && !open) {
        const el = document.activeElement;
        const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable);
        if (!typing) {
          e.preventDefault();
          const search = document.getElementById("global-search-input") as HTMLInputElement | null;
          if (search) search.focus();
          else router.push("/search");
        }
      }
    };
    const openEvt = () => setOpen(true);
    document.addEventListener("keydown", down);
    window.addEventListener("command-palette:open", openEvt);
    return () => {
      document.removeEventListener("keydown", down);
      window.removeEventListener("command-palette:open", openEvt);
    };
  }, [open, router]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const runSearch = () => {
    if (!query.trim()) return go("/search");
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent hideClose className="max-w-xl gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command
          className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
          shouldFilter
        >
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) {
                  // Only jump to full search if no item is highlighted match
                }
              }}
              placeholder="Search decisions or jump to a page…"
              className="flex h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-[360px] overflow-y-auto scroll-thin p-2">
            <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
              No matches. Press Enter to search all decisions.
            </Command.Empty>

            <Command.Group heading="Search">
              <Item onSelect={runSearch} icon={Search} label={query ? `Search “${query}”` : "Open full search"} hint="Enter" />
            </Command.Group>

            <Command.Group heading="Navigate">
              {NAV.map((n) => (
                <Item key={n.href} onSelect={() => go(n.href)} icon={n.icon} label={n.label} hint={n.hint} />
              ))}
            </Command.Group>

            <Command.Group heading="Actions">
              <Item
                onSelect={() => setTheme(theme === "dark" ? "light" : "dark")}
                icon={theme === "dark" ? Sun : Moon}
                label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              />
              <Item
                onSelect={() => setRedact(!redact)}
                icon={ShieldCheck}
                label={redact ? "Disable name redaction" : "Enable name redaction"}
              />
            </Command.Group>
          </Command.List>
          <div className="flex items-center justify-between border-t px-3 py-2 text-[11px] text-muted-foreground">
            <span>Apof.ai — not an official Mahkamah Agung product</span>
            <span className="hidden sm:flex items-center gap-1">
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">⌘K</kbd> to toggle
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function Item({
  onSelect,
  icon: Icon,
  label,
  hint,
}: {
  onSelect: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground/90",
        "data-[selected=true]:bg-muted data-[selected=true]:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="flex-1">{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      <ArrowRight className="h-3.5 w-3.5 opacity-0 data-[selected=true]:opacity-60" />
    </Command.Item>
  );
}
