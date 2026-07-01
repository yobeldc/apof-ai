"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Search, Database, Bookmark, Settings } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { TopCommandBar } from "@/components/top-command-bar";
import { CommandPalette } from "@/components/command-palette";
import { cn } from "@/lib/utils";

const MOBILE_NAV = [
  { label: "Home", href: "/", icon: LayoutDashboard },
  { label: "Search", href: "/search", icon: Search },
  { label: "Ingest", href: "/ingestion", icon: Database },
  { label: "Saved", href: "/saved", icon: Bookmark },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-dvh">
      {/* Skip link (UI UX Pro Max: keyboard users skip nav) */}
      <a
        href="#main-content"
        className="sr-only z-50 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg"
      >
        Skip to main content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopCommandBar />
        <main id="main-content" tabIndex={-1} className="flex-1 pb-20 outline-none md:pb-0">
          {children}
        </main>
      </div>
      <CommandPalette />

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t bg-background/90 backdrop-blur-md md:hidden">
        {MOBILE_NAV.map(({ label, href, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
