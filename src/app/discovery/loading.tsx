import { LoadingState, PageShell, Skeleton } from "@/components/ui";

export default function DiscoveryLoading() {
  return (
    <PageShell>
      <LoadingState label="Loading destinations…">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-12 w-full max-w-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </LoadingState>
    </PageShell>
  );
}
