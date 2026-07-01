import { JobLogsView } from "@/components/job-logs-view";

export const metadata = { title: "Job — Apof.ai" };

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobLogsView jobId={id} />;
}
