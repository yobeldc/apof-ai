"use client";

import { Eye, ShieldCheck, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { usePrivacy } from "@/components/privacy-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function SettingsPrivacy() {
  const { hideNames, redact, setHideNames, setRedact } = usePrivacy();
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6">
      {/* Appearance */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Appearance</h2>
        <Card>
          <CardContent className="p-5">
            <Label className="mb-2 block">Theme</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "light", label: "Light", icon: Sun },
                { id: "dark", label: "Dark", icon: Moon },
                { id: "system", label: "System", icon: Monitor },
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors",
                      theme === t.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted",
                    )}
                  >
                    <Icon className="h-4 w-4" /> {t.label}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Privacy */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Privacy</h2>
        <Card>
          <CardContent className="divide-y p-0">
            <Row
              icon={Eye}
              title="Hide party names in list views"
              desc="Replaces party names with an em-dash across search results and cards."
              checked={hideNames}
              onChange={setHideNames}
            />
            <Row
              icon={ShieldCheck}
              title="Redaction mode"
              desc="Masks detected party/person names (e.g. ▮▮▮▮) while keeping structure intact."
              checked={redact}
              onChange={setRedact}
            />
          </CardContent>
        </Card>
        <p className="mt-2 text-xs text-muted-foreground">
          This app deliberately avoids a “search by person” focus. Court decisions can contain sensitive personal data —
          handle it responsibly and prefer the official source for anything consequential.
        </p>
      </section>
    </div>
  );
}

function Row({
  icon: Icon,
  title,
  desc,
  checked,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-5">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
