import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { SignOutButton } from "./sign-out-button";
import { formatTripDates } from "@/lib/date-utils";
import {
  PageShell,
  PageHeader,
  Card,
  EmptyState,
  Badge,
  Figure,
  formatInr,
  buttonStyles,
} from "@/components/ui";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [trips, recentActivitiesRaw] = await Promise.all([
    prisma.trip.findMany({
      where: { creatorId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.recentActivity.findMany({
      where: { userId: session.user.id, type: "VIEW_TRIP", tripId: { not: null } },
      orderBy: { viewedAt: "desc" },
      take: 3,
    })
  ]);

  const recentTripIds = recentActivitiesRaw.map(r => r.tripId as string).filter(Boolean);
  const recentTripsData = await prisma.trip.findMany({
    where: { id: { in: recentTripIds } }
  });

  const recentActivities = recentActivitiesRaw.map(activity => ({
    ...activity,
    trip: recentTripsData.find(t => t.id === activity.tripId)
  }));

  return (
    <PageShell>
      <PageHeader
        eyebrow={`Welcome, ${session.user.name}`}
        title="Your Trips"
        actions={
          <>
            <Link href="/discovery" className={buttonStyles({ variant: "secondary" })}>
              Discover
            </Link>
            <Link
              href="/dashboard/favorites"
              className={buttonStyles({ variant: "secondary" })}
            >
              Favorites
            </Link>
            <Link href="/trips/new" className={buttonStyles()}>
              New Trip
            </Link>
            <SignOutButton />
          </>
        }
      />

      {recentActivities.some(a => a.trip) && (
        <div className="mb-12">
          <h2 className="text-[0.875rem] font-semibold text-ink-500 uppercase tracking-wider mb-4">Recently Viewed</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {recentActivities.map((activity) => activity.trip && (
              <Link key={activity.id} href={`/trips/${activity.trip.id}`} className="block">
                <Card className="p-4 hover:shadow-md transition-shadow h-full border-lagoon-100 bg-lagoon-50/30">
                  <h3 className="font-semibold text-ink-900 line-clamp-1">{activity.trip.title}</h3>
                  <p className="text-xs text-ink-500 mt-1">
                    {formatTripDates(activity.trip)}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {trips.length === 0 ? (
        <EmptyState
          title="No trips yet"
          hint="Create your first trip to get started."
          action={
            <Link href="/trips/new" className={buttonStyles()}>
              New Trip
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {trips.map((trip) => (
            <Link key={trip.id} href={`/trips/${trip.id}`} className="block">
              <Card interactive>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="font-display text-xl font-semibold text-ink-900">
                      {trip.title}
                    </h2>
                    <p className="text-ink-600 mt-0.5">{trip.destination}</p>
                  </div>
                  <Badge tone="lagoon" className="shrink-0 capitalize">
                    {trip.paceLevel} pace
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-4 text-[0.8125rem] text-ink-500">
                  <span>
                    <Figure>
                      {formatTripDates(trip)}
                    </Figure>
                  </span>
                  <span>
                    Budget{" "}
                    <Figure className="text-ink-700 font-medium">
                      {formatInr(trip.budgetInr)}
                    </Figure>
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </PageShell>
  );
}
