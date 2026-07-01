/**
 * SQLite has no scalar lists, so "list" fields are stored as JSON strings.
 * These helpers (de)serialize them safely — never throw on bad data.
 */

export function toJsonList(list: (string | null | undefined)[] | null | undefined): string {
  const clean = (list ?? []).filter((x): x is string => !!x && x.trim() !== "");
  return JSON.stringify(clean);
}

export function fromJsonList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === "string");
    return [];
  } catch {
    // Fallback: treat as comma/newline separated.
    return raw
      .split(/[\n,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

export function toJsonRecord(rec: Record<string, unknown> | null | undefined): string {
  return JSON.stringify(rec ?? {});
}

export function fromJsonRecord<T = Record<string, unknown>>(raw: string | null | undefined): T {
  if (!raw) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return {} as T;
  }
}
