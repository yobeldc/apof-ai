import { describe, it, expect } from "vitest";
import { normalizeUrl, isAllowedSource, looksLikeDetailUrl } from "../src/lib/normalize-url";

describe("normalizeUrl", () => {
  it("forces https and lowercases host", () => {
    expect(normalizeUrl("http://Putusan3.MahkamahAgung.go.id/x")).toBe(
      "https://putusan3.mahkamahagung.go.id/x",
    );
  });

  it("strips fragments", () => {
    expect(normalizeUrl("https://putusan3.mahkamahagung.go.id/x#section")).toBe(
      "https://putusan3.mahkamahagung.go.id/x",
    );
  });

  it("removes tracking params and sorts the rest", () => {
    expect(
      normalizeUrl("https://putusan3.mahkamahagung.go.id/x?utm_source=a&b=2&a=1"),
    ).toBe("https://putusan3.mahkamahagung.go.id/x?a=1&b=2");
  });

  it("drops a trailing slash but keeps root", () => {
    expect(normalizeUrl("https://putusan3.mahkamahagung.go.id/x/")).toBe(
      "https://putusan3.mahkamahagung.go.id/x",
    );
    expect(normalizeUrl("https://putusan3.mahkamahagung.go.id/")).toBe(
      "https://putusan3.mahkamahagung.go.id/",
    );
  });

  it("drops default ports", () => {
    expect(normalizeUrl("https://putusan3.mahkamahagung.go.id:443/x")).toBe(
      "https://putusan3.mahkamahagung.go.id/x",
    );
  });

  it("adds scheme to a bare host", () => {
    expect(normalizeUrl("putusan3.mahkamahagung.go.id/x")).toBe(
      "https://putusan3.mahkamahagung.go.id/x",
    );
  });

  it("returns null for garbage", () => {
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl("not a url")).toBeNull();
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
  });

  it("two equivalent URLs normalize identically (dedup)", () => {
    const a = normalizeUrl("http://putusan3.mahkamahagung.go.id/direktori/putusan/abc/?ref=x#y");
    const b = normalizeUrl("https://putusan3.mahkamahagung.go.id/direktori/putusan/abc");
    expect(a).toBe(b);
  });
});

describe("isAllowedSource", () => {
  it("accepts the allowed host", () => {
    expect(isAllowedSource("https://putusan3.mahkamahagung.go.id/x")).toBe(true);
  });
  it("rejects other hosts", () => {
    expect(isAllowedSource("https://evil.example.com/x")).toBe(false);
    expect(isAllowedSource("https://google.com")).toBe(false);
  });
});

describe("looksLikeDetailUrl", () => {
  it("matches direktori/putusan detail paths", () => {
    expect(
      looksLikeDetailUrl("https://putusan3.mahkamahagung.go.id/direktori/putusan/abc123.html"),
    ).toBe(true);
  });
  it("does not match a bare listing page", () => {
    expect(looksLikeDetailUrl("https://putusan3.mahkamahagung.go.id/direktori.html")).toBe(false);
  });
});
