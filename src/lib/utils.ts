import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format an ISO date string (or null) for display. Returns em-dash if empty. */
export function fmtDate(iso?: string | null, opts?: Intl.DateTimeFormatOptions) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso; // keep raw if unparseable
  return d.toLocaleDateString("id-ID", opts ?? { year: "numeric", month: "long", day: "numeric" });
}

/** Non-empty value or em-dash, so list cells never render blank/"null". */
export function orDash(v?: string | number | null) {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

export function pluralize(n: number, singular: string, plural?: string) {
  return `${n.toLocaleString("en-US")} ${n === 1 ? singular : plural ?? singular + "s"}`;
}

/** Redact a person/party name to fixed-width blocks, preserving word count. */
export function redactName(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => "▮".repeat(Math.max(2, Math.min(w.length, 8))))
    .join(" ");
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
