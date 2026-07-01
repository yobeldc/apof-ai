import Link from "next/link";
import { FolderOpen, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { orDash } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Collections — Apof.ai" };

export default async function CollectionsPage() {
  const saved = await prisma.savedCase.findMany({
    include: { case: { select: { id: true, nomorPutusan: true, pengadilan: true, tahun: true } } },
    orderBy: { createdAt: "desc" },
  });

  const byCollection = new Map<string, typeof saved>();
  for (const s of saved) {
    const arr = byCollection.get(s.collectionName) ?? [];
    arr.push(s);
    byCollection.set(s.collectionName, arr);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <FolderOpen className="h-6 w-6 text-primary" /> Research collections
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Group saved decisions into themed research sets.</p>
      </div>

      {byCollection.size === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No collections yet"
          description="Saving a case automatically adds it to your Default collection. Build more as your research grows."
          action={
            <Button asChild>
              <Link href="/search">Find cases to save</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from(byCollection.entries()).map(([name, items]) => (
            <Card key={name}>
              <CardContent className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold">{name}</h2>
                  <span className="text-xs text-muted-foreground tabular">{items.length} case(s)</span>
                </div>
                <div className="space-y-1">
                  {items.slice(0, 6).map((s) => (
                    <Link
                      key={s.id}
                      href={`/cases/${s.case.id}`}
                      className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <span className="truncate font-mono text-xs">{orDash(s.case.nomorPutusan)}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
