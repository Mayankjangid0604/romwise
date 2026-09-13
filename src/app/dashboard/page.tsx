import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { SignOutButton } from "./sign-out-button";
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

  const trips = await prisma.trip.findMany({
    where: { creatorId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

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
              href="/group-alignment"
              className={buttonStyles({ variant: "secondary" })}
            >
              Group Alignment
            </Link>
            <Link href="/trips/new" className={buttonStyles()}>
              New Trip
            </Link>
            <SignOutButton />
          </>
        }
      />

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
                      {new Date(trip.startDate).toLocaleDateString()}
                    </Figure>{" "}
                    &ndash;{" "}
                    <Figure>{new Date(trip.endDate).toLocaleDateString()}</Figure>
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
