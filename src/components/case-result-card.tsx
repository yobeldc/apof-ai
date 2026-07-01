"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Building2, Calendar, FileText, Scale, Users } from "lucide-react";
import type { SearchHit } from "@/lib/search";
import { Badge } from "@/components/ui/badge";
import { DataQualityBadge } from "@/components/data-quality-badge";
import { SourceLinkButton } from "@/components/source-link-button";
import { SaveCaseButton } from "@/components/save-case-button";
import { usePrivacy } from "@/components/privacy-provider";
import { orDash } from "@/lib/utils";

const SENSITIVE = ["anak", "agama", "asusila", "kdrt"];

export function CaseResultCard({ hit, index = 0 }: { hit: SearchHit; index?: number }) {
  const { transform, hideNames } = usePrivacy();
  const isDemo = hit.sourceUrl.includes("/demo-");
  const sensitive = SENSITIVE.some((s) => (hit.klasifikasi ?? "").toLowerCase().includes(s));

  const parties = hit.pihak.slice(0, 2).map(transform).filter((p) => p !== "—" || !hideNames);
  const partyLine = hideNames ? "Party names hidden" : parties.join("  ·  ") || "—";

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay: Math.min(index, 10) * 0.024, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <Link
        href={`/cases/${hit.id}`}
        aria-label={`Open decision ${hit.nomorPutusan ?? hit.id}`}
        className="group block rounded-lg border bg-card p-4 transition-all hover:border-ring hover:shadow-md focus-visible:border-ring sm:p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-mono text-sm font-semibold text-foreground">
              {orDash(hit.nomorPutusan)}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {orDash(hit.pengadilan ?? hit.lembagaPeradilan)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {orDash(hit.tahun)}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isDemo && <Badge variant="outline">Demo</Badge>}
            <SaveCaseButton caseId={hit.id} initialSaved={hit.isSaved} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {hit.tingkatProses && <Badge variant="primary">{hit.tingkatProses}</Badge>}
          {hit.klasifikasi && <Badge variant="accent">{hit.klasifikasi}</Badge>}
          {sensitive && <Badge variant="warning">Sensitive</Badge>}
        </div>

        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-foreground/80">
          <span className="font-medium text-foreground/60">Amar: </span>
          {orDash(hit.amarPutusan ?? hit.ringkasanSingkat)}
        </p>

        <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{partyLine}</span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
          <div className="flex items-center gap-2">
            <DataQualityBadge status={hit.extractionStatus} />
            {hit.hasPdf && (
              <Badge variant="outline">
                <FileText className="h-3 w-3" /> PDF
              </Badge>
            )}
            {hit.hasFullText && (
              <Badge variant="outline">
                <Scale className="h-3 w-3" /> Full text
              </Badge>
            )}
          </div>
          <SourceLinkButton url={hit.sourceUrl} />
        </div>
      </Link>
    </motion.article>
  );
}
