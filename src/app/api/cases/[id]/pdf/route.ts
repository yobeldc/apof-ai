import { promises as fs } from "node:fs";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Stream a locally-stored (offline-imported) decision PDF to the browser. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await prisma.caseDecision.findUnique({
    where: { id },
    select: { localPdfPath: true, nomorPutusan: true },
  });
  if (!c?.localPdfPath) {
    return new Response("No local PDF for this case", { status: 404 });
  }
  try {
    const data = await fs.readFile(c.localPdfPath);
    const filename = (c.nomorPutusan ?? id).replace(/[^\w.-]+/g, "_") + ".pdf";
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("PDF file missing on disk", { status: 404 });
  }
}
