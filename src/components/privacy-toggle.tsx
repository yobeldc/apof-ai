"use client";

import { ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePrivacy } from "@/components/privacy-provider";

export function PrivacyToggle() {
  const { redact, setRedact } = usePrivacy();
  return (
    <Button
      variant={redact ? "secondary" : "ghost"}
      size="icon-sm"
      aria-label={redact ? "Disable name redaction" : "Enable name redaction"}
      title={redact ? "Redaction ON — party names hidden" : "Redaction OFF"}
      onClick={() => setRedact(!redact)}
    >
      {redact ? <ShieldCheck className="h-4 w-4 text-warning" /> : <ShieldOff className="h-4 w-4" />}
    </Button>
  );
}
