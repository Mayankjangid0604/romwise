import Link from "next/link";
export function TripWorkspaceNav({ tripId }: { tripId: string }) {
  return (
    <nav className="trip-workspace-nav">
      <Link href={`/trips/${tripId}`}>Overview</Link>
      <Link href={`/trips/${tripId}/itinerary`}>Itinerary</Link>
      <Link href={`/trips/${tripId}/route`}>Route</Link>
      <Link href={`/trips/${tripId}/budget`}>Budget</Link>
      <Link href={`/trips/${tripId}/info`}>Info</Link>
      <Link href={`/trips/${tripId}/group`}>Group</Link>
    </nav>
  );
}
