import { NextResponse } from "next/server";
import { exportApofGraphToCsv, exportToJson } from "@/lib/apof-graph/export";

/**
 * POST /api/apof-graph/export
 * Exports Apof Graph data as CSV or JSON.
 * Body: { format: "csv" | "json", filters: ExportFilters }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { format, filters } = body;

    if (format === "csv") {
      const result = await exportApofGraphToCsv(filters ?? {});
      return NextResponse.json(result);
    }

    if (format === "json") {
      const json = await exportToJson([]);
      return NextResponse.json({
        json,
        filename: `apof-graph-export-${Date.now()}.json`,
        caseCount: 0,
      });
    }

    return NextResponse.json(
      { error: "format must be 'csv' or 'json'" },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
