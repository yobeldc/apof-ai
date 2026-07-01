import { CheckCircle2, CircleDashed, CircleSlash, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const MAP = {
  complete: { variant: "success" as const, icon: CheckCircle2, label: "Complete" },
  partial: { variant: "warning" as const, icon: CircleDashed, label: "Partial" },
  pending: { variant: "outline" as const, icon: CircleDashed, label: "Pending" },
  failed: { variant: "destructive" as const, icon: AlertCircle, label: "Failed" },
};

export function DataQualityBadge({ status, className }: { status: string; className?: string }) {
  const cfg = MAP[status as keyof typeof MAP] ?? {
    variant: "outline" as const,
    icon: CircleSlash,
    label: status,
  };
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} className={className} title={`Extraction: ${cfg.label}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}
