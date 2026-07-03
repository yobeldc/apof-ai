import { Suspense } from "react";
import { ApofGraphDashboard } from "@/components/apof-graph-dashboard";
import { Skeleton } from "@/components/ui/skeleton";

export default function ApofGraphPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <ApofGraphDashboard />
    </Suspense>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
