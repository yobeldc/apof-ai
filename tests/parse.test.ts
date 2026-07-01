import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseDecisionPage, extractPdfUrl } from "../src/lib/parse";
import { extractDetailLinks, extractNextPage } from "../src/lib/discover";

const decisionHtml = readFileSync(
  fileURLToPath(new URL("./fixtures/decision.html", import.meta.url)),
  "utf8",
);
const listingHtml = readFileSync(
  fileURLToPath(new URL("./fixtures/listing.html", import.meta.url)),
  "utf8",
);

const URL_BASE = "https://putusan3.mahkamahagung.go.id/direktori/putusan/abc123.html";

describe("parseDecisionPage", () => {
  const parsed = parseDecisionPage(decisionHtml, URL_BASE);

  it("extracts the nomor putusan from the metadata table", () => {
    expect(parsed.nomorPutusan).toBe("2451 K/Pid.Sus/2021");
    expect(parsed.confidence.nomorPutusan).toBe(1);
  });

  it("extracts process level and classification", () => {
    expect(parsed.tingkatProses).toBe("Kasasi");
    expect(parsed.klasifikasi).toBe("Pidana Khusus");
  });

  it("extracts the year as a number", () => {
    expect(parsed.tahun).toBe(2021);
  });

  it("collects judges from Hakim Ketua + Hakim Anggota", () => {
    expect(parsed.hakim).toContain("Dr. Suhadi, S.H., M.H.");
    expect(parsed.hakim.length).toBeGreaterThanOrEqual(3);
  });

  it("extracts keywords as a list", () => {
    expect(parsed.kataKunci).toEqual(["korupsi", "kerugian negara"]);
  });

  it("captures full text and an amar", () => {
    expect(parsed.fullText).toBeTruthy();
    expect((parsed.amarPutusan ?? "").length).toBeGreaterThan(0);
  });

  it("never invents missing fields (uses null)", () => {
    expect(parsed.provinsi).toBeNull();
    expect(parsed.penggugat).toBeNull();
  });

  it("marks extraction complete when core fields + full text exist", () => {
    expect(parsed.extractionStatus).toBe("complete");
  });
});

describe("extractPdfUrl", () => {
  it("resolves a relative PDF link to absolute", () => {
    const pdf = extractPdfUrl(decisionHtml, URL_BASE);
    expect(pdf).toBe("https://putusan3.mahkamahagung.go.id/direktori/putusan/abc123/pdf/download.pdf");
  });
});

describe("discover helpers", () => {
  it("extracts and dedupes detail links, ignoring noise", () => {
    const links = extractDetailLinks(listingHtml, "https://putusan3.mahkamahagung.go.id/direktori.html");
    expect(links).toContain("https://putusan3.mahkamahagung.go.id/direktori/putusan/abc111.html");
    expect(links).toContain("https://putusan3.mahkamahagung.go.id/direktori/putusan/abc222.html");
    // Deduped + no external/listing links.
    expect(links.length).toBe(2);
    expect(links.some((l) => l.includes("google.com"))).toBe(false);
  });

  it("finds the next pagination page", () => {
    const next = extractNextPage(listingHtml, "https://putusan3.mahkamahagung.go.id/direktori.html");
    expect(next).toBe("https://putusan3.mahkamahagung.go.id/direktori/index/page/2.html");
  });
});
