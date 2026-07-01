import { notFound } from "next/navigation";
import { getCaseForClient, getSimilarCases } from "@/lib/case";
import { CaseDetail } from "@/components/case-detail";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getCaseForClient(id);
  return { title: data ? `${data.case.nomorPutusan ?? "Decision"} — Apof.ai` : "Decision — Apof.ai" };
}

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getCaseForClient(id);
  if (!data) notFound();

  const similar = await getSimilarCases(data.case);
  return <CaseDetail case={data.case} notes={data.notes} similar={similar} />;
}
