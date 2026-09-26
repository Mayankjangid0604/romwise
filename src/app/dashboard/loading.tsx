import { LoadingState, PageShell, Skeleton } from "@/components/ui";

export default function DashboardLoading() {
  return (
    <PageShell width="default" className="max-w-7xl">
      <LoadingState label="Loading your trips…" className="py-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3">
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-5 w-40" />
          </div>
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[74px]" />
          ))}
        </div>
        <Skeleton className="h-56 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      </LoadingState>
    </PageShell>
  );
}
