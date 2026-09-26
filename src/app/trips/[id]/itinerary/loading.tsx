import { LoadingState, Skeleton } from "@/components/ui";

export default function ItineraryLoading() {
  return (
    <LoadingState label="Loading itinerary…">
      <Skeleton className="h-[74px] w-full" />
      {[0, 1].map((day) => (
        <div key={day} className="space-y-4">
          <Skeleton className="h-7 w-56" />
          <div className="ml-4 pl-6 border-l-2 border-ink-100 space-y-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      ))}
    </LoadingState>
  );
}
