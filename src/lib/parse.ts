import * as cheerio from "cheerio";
import { normalizeUrl } from "./normalize-url";

/**
 * Deterministic-first decision parser.
 *  1. Parse the metadata table with HTML selectors (label → value).
 *  2. Fall back to text heuristics for fields not found in the table.
 *  3. Never invent values — missing fields are null.
 *  4. Emit a per-field confidence score (1 = selector hit, 0.6 = heuristic).
 *
 * An optional LLM extraction layer can refine this later (see src/lib/llm.ts);
 * the parser does not depend on it.
 */

export type ParsedDecision = {
  nomorPutusan: string | null;
  tingkatProses: string | null;
  klasifikasi: string | null;
  kataKunci: string[];
  tahun: number | null;
  tanggalRegister: string | null;
  tanggalPutusan: string | null;
  tanggalMusyawarah: string | null;
  lembagaPeradilan: string | null;
  jenisLembagaPeradilan: string | null;
  pengadilan: string | null;
  provinsi: string | null;
  hakim: string[];
  panitera: string | null;
  pihak: string[];
  pemohon: string | null;
  termohon: string | null;
  terdakwa: string | null;
  penggugat: string | null;
  tergugat: string | null;
  amarPutusan: string | null;
  ringkasanSingkat: string | null;
  fullText: string | null;
  pdfUrl: string | null;
  confidence: Record<string, number>;
  extractionStatus: "partial" | "complete" | "failed";
};

/** Map normalized table labels → canonical field keys. */
const LABEL_MAP: Record<string, keyof ParsedDecision | "hakimKetua" | "hakimAnggota" | "catatanAmar"> = {
  nomor: "nomorPutusan",
  "tingkat proses": "tingkatProses",
  klasifikasi: "klasifikasi",
  "kata kunci": "kataKunci",
  tahun: "tahun",
  "tanggal register": "tanggalRegister",
  "tanggal musyawarah": "tanggalMusyawarah",
  "tanggal dibacakan": "tanggalPutusan",
  "tanggal putusan": "tanggalPutusan",
  "lembaga peradilan": "lembagaPeradilan",
  "jenis lembaga peradilan": "jenisLembagaPeradilan",
  pengadilan: "pengadilan",
  provinsi: "provinsi",
  "hakim ketua": "hakimKetua",
  "hakim anggota": "hakimAnggota",
  hakim: "hakim",
  "panitera pengganti": "panitera",
  panitera: "panitera",
  amar: "amarPutusan",
  "amar lainnya": "amarPutusan",
  "catatan amar": "catatanAmar",
  "para pihak": "pihak",
  pihak: "pihak",
};

function norm(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function splitPeople(value: string): string[] {
  // Names are separated by ; / newlines / " dan " — NOT commas, because
  // Indonesian names embed commas in titles ("Dr. X, S.H., M.H.").
  return value
    .split(/[\n;]| dan | - |—/i)
    .map((x) => norm(x))
    .filter((x) => x && x.length > 1 && !/^-+$/.test(x));
}

function yearFrom(value: string): number | null {
  const m = value.match(/\b(19|20)\d{2}\b/);
  return m ? Number(m[0]) : null;
}

export function extractPdfUrl(html: string, baseUrl: string): string | null {
  const $ = cheerio.load(html);
  const base = normalizeUrl(baseUrl) ?? baseUrl;

  // 1. Explicit .pdf anchors.
  let href =
    $('a[href$=".pdf"]').first().attr("href") ||
    $('a[href*="/pdf/"]').first().attr("href") ||
    $('a[href*="download"]').filter((_, el) => /pdf/i.test($(el).text())).first().attr("href");

  if (!href) {
    // 2. Anchor whose label mentions PDF.
    $("a").each((_, el) => {
      if (href) return;
      const t = $(el).text().toLowerCase();
      if (t.includes("pdf") || t.includes("unduh")) href = $(el).attr("href") || undefined;
    });
  }
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

export function parseDecisionPage(html: string, url: string): ParsedDecision {
  const $ = cheerio.load(html);
  const confidence: Record<string, number> = {};
  const out: Partial<ParsedDecision> = { kataKunci: [], hakim: [], pihak: [] };
  const hakimSet = new Set<string>();

  const setField = (key: string, value: string, conf: number) => {
    const v = norm(value);
    if (!v) return;
    switch (key) {
      case "kataKunci":
        out.kataKunci = v.split(/[,;]/).map((x) => norm(x)).filter(Boolean);
        break;
      case "tahun":
        out.tahun = yearFrom(v);
        break;
      case "hakimKetua":
      case "hakimAnggota":
      case "hakim":
        splitPeople(v).forEach((p) => hakimSet.add(p));
        break;
      case "pihak":
        out.pihak = splitPeople(v);
        break;
      case "catatanAmar":
        if (!out.amarPutusan) out.amarPutusan = v;
        break;
      default:
        // @ts-expect-error dynamic assignment to known keys
        out[key] = v;
    }
    confidence[key === "hakimKetua" || key === "hakimAnggota" ? "hakim" : key] = conf;
  };

  // --- 1. Deterministic table parse -----------------------------------------
  $("table tr").each((_, tr) => {
    const cells = $(tr).find("td, th");
    if (cells.length < 2) return;
    const label = norm($(cells[0]).text()).toLowerCase().replace(/[:：]\s*$/, "");
    const value = norm($(cells[1]).text());
    if (!label || !value) return;
    const key = LABEL_MAP[label];
    if (key) setField(key as string, value, 1);
  });

  // --- 2. Title / nomor putusan from heading or <title> ---------------------
  if (!out.nomorPutusan) {
    const heading = norm($("h1, h2, .judul, .title").first().text());
    const titleTag = norm($("title").text());
    const candidate = heading || titleTag;
    const m = candidate.match(/(?:Nomor|No\.?)\s*[:.]?\s*([0-9][0-9A-Za-z/.\- ]+)/i);
    if (m) setField("nomorPutusan", m[1], 0.6);
    else if (/\d+\s*[KkPp]?\/?[A-Za-z.]+\/\d{4}/.test(candidate)) {
      const m2 = candidate.match(/[\w.]+\/[\w.]+\/\d{4}|\d+\s*K\/[\w.]+\/\d{4}/);
      if (m2) setField("nomorPutusan", m2[0], 0.5);
    }
  }

  hakimSet.forEach(() => {});
  out.hakim = Array.from(hakimSet);

  // --- 3. Full text / body --------------------------------------------------
  const bodyText =
    norm($("#popup-detail, .putusan-detail, .content, #content, article, main").text()) ||
    norm($("body").text());
  if (bodyText && bodyText.length > 200) {
    out.fullText = bodyText.slice(0, 200_000);
    confidence.fullText = 0.5;
  }

  // --- 4. Heuristic fallbacks from full text --------------------------------
  if (out.fullText) {
    if (!out.amarPutusan) {
      const amarMatch = out.fullText.match(/M\s*E\s*N\s*G\s*A\s*D\s*I\s*L\s*I[\s:.-]*([\s\S]{0,800}?)(?:Demikian|Putusan ini|Ditetapkan|$)/i);
      if (amarMatch) setField("amarPutusan", amarMatch[1], 0.4);
    }
    if (!out.tahun && out.tanggalPutusan) out.tahun = yearFrom(out.tanggalPutusan);
    // Parties heuristics.
    const grab = (re: RegExp) => {
      const m = out.fullText!.match(re);
      return m ? norm(m[1]).slice(0, 200) : null;
    };
    out.pemohon ??= grab(/Pemohon[^:]*:\s*([^\n]{2,200})/i);
    out.termohon ??= grab(/Termohon[^:]*:\s*([^\n]{2,200})/i);
    out.terdakwa ??= grab(/Terdakwa[^:]*:\s*([^\n]{2,200})/i);
    out.penggugat ??= grab(/Penggugat[^:]*:\s*([^\n]{2,200})/i);
    out.tergugat ??= grab(/Tergugat[^:]*:\s*([^\n]{2,200})/i);
    if (out.pemohon) confidence.pemohon = 0.4;
    if (out.terdakwa) confidence.terdakwa = 0.4;
  }

  // --- 5. PDF ---------------------------------------------------------------
  out.pdfUrl = extractPdfUrl(html, url);
  if (out.pdfUrl) confidence.pdfUrl = 1;

  // --- 6. Short summary (deterministic, extractive) -------------------------
  out.ringkasanSingkat =
    out.amarPutusan?.slice(0, 280) ??
    (out.fullText ? out.fullText.slice(0, 280) : null);

  // --- Status ---------------------------------------------------------------
  const coreFilled = [out.nomorPutusan, out.amarPutusan, out.pengadilan].filter(Boolean).length;
  const status: ParsedDecision["extractionStatus"] =
    out.nomorPutusan == null && out.fullText == null
      ? "failed"
      : coreFilled >= 2 && out.fullText
        ? "complete"
        : "partial";

  return {
    nomorPutusan: out.nomorPutusan ?? null,
    tingkatProses: out.tingkatProses ?? null,
    klasifikasi: out.klasifikasi ?? null,
    kataKunci: out.kataKunci ?? [],
    tahun: out.tahun ?? null,
    tanggalRegister: out.tanggalRegister ?? null,
    tanggalPutusan: out.tanggalPutusan ?? null,
    tanggalMusyawarah: out.tanggalMusyawarah ?? null,
    lembagaPeradilan: out.lembagaPeradilan ?? null,
    jenisLembagaPeradilan: out.jenisLembagaPeradilan ?? null,
    pengadilan: out.pengadilan ?? null,
    provinsi: out.provinsi ?? null,
    hakim: out.hakim ?? [],
    panitera: out.panitera ?? null,
    pihak: out.pihak ?? [],
    pemohon: out.pemohon ?? null,
    termohon: out.termohon ?? null,
    terdakwa: out.terdakwa ?? null,
    penggugat: out.penggugat ?? null,
    tergugat: out.tergugat ?? null,
    amarPutusan: out.amarPutusan ?? null,
    ringkasanSingkat: out.ringkasanSingkat ?? null,
    fullText: out.fullText ?? null,
    pdfUrl: out.pdfUrl ?? null,
    confidence,
    extractionStatus: status,
  };
}
