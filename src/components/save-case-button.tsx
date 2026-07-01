"use client";

import * as React from "react";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SaveCaseButton({
  caseId,
  initialSaved,
  variant = "ghost",
  withLabel = false,
}: {
  caseId: string;
  initialSaved: boolean;
  variant?: "ghost" | "outline" | "secondary";
  withLabel?: boolean;
}) {
  const [saved, setSaved] = React.useState(initialSaved);
  const [pending, setPending] = React.useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    setPending(true);
    const next = !saved;
    setSaved(next); // optimistic
    try {
      const res = await fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, save: next }),
      });
      if (!res.ok) throw new Error("Request failed");
      toast.success(next ? "Saved to collection" : "Removed from saved");
    } catch {
      setSaved(!next); // rollback
      toast.error("Could not update saved state");
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      variant={saved ? "secondary" : variant}
      size={withLabel ? "sm" : "icon-sm"}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save case"}
      onClick={toggle}
      disabled={pending}
      className={cn(withLabel && "gap-1.5")}
    >
      <Bookmark className={cn("h-4 w-4", saved && "fill-current text-primary")} />
      {withLabel && (saved ? "Saved" : "Save")}
    </Button>
  );
}
