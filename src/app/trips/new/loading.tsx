import { LoadingState, PageShell, Skeleton } from "@/components/ui";

export default function NewTripLoading() {
  return (
    <PageShell width="form">
      <LoadingState label="Loading trip planner…">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-72 w-full" />
      </LoadingState>
    </PageShell>
  );
}
