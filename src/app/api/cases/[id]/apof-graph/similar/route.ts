import { NextResponse } from "next/server";
import { findSimilarCases } from "@/lib/apof-graph/similarity";

/**
 * GET /api/cases/[id]/apof-graph/similar
 * Returns similar cases for a given case.
 * Query params: limit (default 5), refresh (default false)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") ?? "5", 10);

    const similar = await findSimilarCases(id, limit);

    return NextResponse.json({ similar });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
