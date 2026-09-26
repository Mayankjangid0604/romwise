import { LoadingState, Skeleton } from "@/components/ui";

// Shown instantly (under the trip tab bar, which stays interactive) while any trip
// tab's server data loads. Also lets <Link> prefetch these dynamic routes.
export default function TripTabLoading() {
  return (
    <LoadingState label="Loading trip…">
      <Skeleton className="h-28 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
      </div>
      <Skeleton className="h-64 w-full" />
    </LoadingState>
  );
}
