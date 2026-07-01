import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

/** Always-present link back to the official source. Provenance > convenience. */
export function SourceLinkButton({
  url,
  className,
  label = "Source",
}: {
  url: string;
  className?: string;
  label?: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
      title="Open the official decision page on putusan3.mahkamahagung.go.id"
    >
      <ExternalLink className="h-3.5 w-3.5" />
      {label}
    </a>
  );
}
