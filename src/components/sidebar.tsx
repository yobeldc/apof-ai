"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  Sparkles,
  Database,
  Bookmark,
  FolderOpen,
  Settings,
  Info,
  Scale,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Search", href: "/search", icon: Search },
  { label: "Ask Apof.ai", href: "/ask", icon: Sparkles },
  { label: "Ingestion", href: "/ingestion", icon: Database },
  { label: "Saved", href: "/saved", icon: Bookmark },
  { label: "Collections", href: "/collections", icon: FolderOpen },
];

const SECONDARY = [
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "About", href: "/about", icon: Info },
];

export function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <aside className="hidden md:flex h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2.5 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-sm ring-1 ring-inset ring-white/10">
          <Scale className="h-4 w-4" strokeWidth={2.2} />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight text-foreground">Apof.ai</div>
          <div className="text-[10px] text-muted-foreground">Personal legal research</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-3">
        <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Workspace
        </p>
        {NAV.map((item) => (
          <NavLink key={item.href} {...item} active={isActive(item.href)} />
        ))}
        <p className="px-2 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          System
        </p>
        {SECONDARY.map((item) => (
          <NavLink key={item.href} {...item} active={isActive(item.href)} />
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="rounded-lg bg-muted/50 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground/80">Not an official Mahkamah Agung product.</p>
          <p className="mt-1">
            A personal cache & interface. The court site is the source of truth.
          </p>
        </div>
      </div>
    </aside>
  );
}

function NavLink({
  label,
  href,
  icon: Icon,
  active,
}: {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors duration-200",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
      )}
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
