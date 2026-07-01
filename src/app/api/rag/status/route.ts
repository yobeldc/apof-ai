import { NextResponse } from "next/server";
import { getRagStatus } from "@/lib/rag/index";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getRagStatus();
  return NextResponse.json(status);
}
