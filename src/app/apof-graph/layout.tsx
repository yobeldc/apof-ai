import type { ReactNode } from "react";
import { Separator } from "@/components/ui/separator";

export default function ApofGraphLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b px-6 py-4">
        <h1 className="text-2xl font-bold tracking-tight">Apof Graph</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Structured legal graph over Indonesian court decisions. Extracted entities,
          normalized connections, and analytics for research purposes only.
        </p>
      </header>
      <Separator />
      <main className="flex-1 p-6">{children}</main>
      <footer className="border-t px-6 py-3 text-xs text-muted-foreground">
        Apof Graph is a research tool. It does not constitute legal advice.
        Always verify against original sources.
      </footer>
    </div>
  );
}
