import { env } from "./env";
import { fromJsonList } from "./serialize";

export const AI_DISCLAIMER =
  "AI summary may be inaccurate. Always verify with the official source.";

export type CaseSummary = {
  ringkasan: string;
  legalIssues: string[];
  outcome: string;
  timeline: { date: string | null; label: string }[];
  method: "deterministic" | "llm";
  disclaimer: string;
};

type CaseLike = {
  nomorPutusan: string | null;
  klasifikasi: string | null;
  tingkatProses: string | null;
  pengadilan: string | null;
  lembagaPeradilan: string | null;
  amarPutusan: string | null;
  fullText: string | null;
  kataKunci: string | null;
  tanggalRegister: string | null;
  tanggalMusyawarah: string | null;
  tanggalPutusan: string | null;
};

/** Deterministic, extractive Indonesian summary — no external dependency. */
export function deterministicSummary(c: CaseLike): CaseSummary {
  const court = c.pengadilan ?? c.lembagaPeradilan ?? "pengadilan terkait";
  const jenis = c.klasifikasi ? `perkara ${c.klasifikasi.toLowerCase()}` : "perkara";
  const tingkat = c.tingkatProses ? `pada tingkat ${c.tingkatProses.toLowerCase()}` : "";

  const amar = (c.amarPutusan ?? "").trim();
  const outcome = amar
    ? amar.slice(0, 320)
    : "Amar putusan tidak terbaca dari halaman sumber.";

  const ringkasan = [
    `Putusan ${c.nomorPutusan ?? "(nomor tidak terbaca)"} merupakan ${jenis} yang diperiksa di ${court} ${tingkat}`.trim() + ".",
    amar ? `Inti amar: ${outcome}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const keywords = fromJsonList(c.kataKunci);
  const legalIssues = keywords.length
    ? keywords.map((k) => `Isu hukum terkait: ${k}`)
    : deriveIssuesFromText(c.fullText);

  const timeline = [
    { date: c.tanggalRegister, label: "Register perkara" },
    { date: c.tanggalMusyawarah, label: "Musyawarah majelis" },
    { date: c.tanggalPutusan, label: "Putusan dibacakan" },
  ].filter((t) => t.date);

  return {
    ringkasan,
    legalIssues: legalIssues.slice(0, 6),
    outcome,
    timeline,
    method: "deterministic",
    disclaimer: AI_DISCLAIMER,
  };
}

function deriveIssuesFromText(fullText: string | null): string[] {
  if (!fullText) return [];
  const issues: string[] = [];
  const lower = fullText.toLowerCase();
  const cues: Record<string, string> = {
    "melawan hukum": "Dugaan perbuatan melawan hukum",
    wanprestasi: "Sengketa wanprestasi",
    korupsi: "Tindak pidana korupsi",
    narkotika: "Tindak pidana narkotika",
    penipuan: "Dugaan tindak pidana penipuan",
    "ganti rugi": "Tuntutan ganti rugi",
    pesangon: "Sengketa hak pekerja / pesangon",
    talak: "Perkara perceraian",
  };
  for (const [cue, label] of Object.entries(cues)) {
    if (lower.includes(cue)) issues.push(label);
  }
  return issues;
}

/** Optional LLM summary (Anthropic). Falls back to deterministic on any error. */
export async function summarizeCase(c: CaseLike): Promise<CaseSummary> {
  if (!env.llm.enabled || !env.llm.apiKey) return deterministicSummary(c);

  try {
    const prompt = `Anda adalah asisten riset hukum. Ringkas putusan berikut dalam Bahasa Indonesia secara objektif. Jangan mengarang fakta yang tidak ada. Kembalikan JSON dengan kunci: ringkasan (string), legalIssues (array string), outcome (string), timeline (array {date,label}).\n\nNomor: ${c.nomorPutusan}\nKlasifikasi: ${c.klasifikasi}\nPengadilan: ${c.pengadilan ?? c.lembagaPeradilan}\nAmar: ${c.amarPutusan ?? "-"}\n\nTeks (dipotong):\n${(c.fullText ?? "").slice(0, 6000)}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.llm.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: env.llm.model,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
    const data = await res.json();
    const text = data?.content?.[0]?.text ?? "";
    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    return {
      ringkasan: String(json.ringkasan ?? ""),
      legalIssues: Array.isArray(json.legalIssues) ? json.legalIssues.map(String) : [],
      outcome: String(json.outcome ?? c.amarPutusan ?? ""),
      timeline: Array.isArray(json.timeline) ? json.timeline : [],
      method: "llm",
      disclaimer: AI_DISCLAIMER,
    };
  } catch (err) {
    console.warn("[summarize] LLM failed, using deterministic:", err);
    return deterministicSummary(c);
  }
}
