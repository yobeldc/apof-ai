import { NextResponse } from "next/server";
import { importHtml, importPdf, type ImportResult } from "@/lib/import";

export const dynamic = "force-dynamic";
// Allow larger PDF uploads through the route handler.
export const maxDuration = 60;

/**
 * Offline file import endpoint. Accepts multipart/form-data with one or more
 * `files` (.html / .htm / .pdf saved by the user from their own browser).
 * Performs ZERO network requests — it only parses the uploaded bytes.
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const force = form.get("force") === "true";

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const results: ImportResult[] = [];
  for (const file of files) {
    const name = file.name || "upload";
    const isPdf = /\.pdf$/i.test(name) || file.type === "application/pdf";
    const isHtml = /\.html?$/i.test(name) || file.type === "text/html";

    if (isPdf) {
      const buf = new Uint8Array(await file.arrayBuffer());
      results.push(await importPdf(name, buf, { force }));
    } else if (isHtml) {
      const text = await file.text();
      results.push(await importHtml(name, text, { force }));
    } else {
      results.push({ outcome: "failed", filename: name, error: "Unsupported file type (use .html or .pdf)" });
    }
  }

  const summary = {
    imported: results.filter((r) => r.outcome === "imported").length,
    skipped: results.filter((r) => r.outcome === "skipped").length,
    failed: results.filter((r) => r.outcome === "failed").length,
  };

  return NextResponse.json({ ok: true, summary, results });
}
