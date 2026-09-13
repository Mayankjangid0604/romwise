import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { GenerateButton } from "./generate-button";
import { ReplanPanel } from "./replan-panel";
import {
  PageShell,
  PageHeader,
  SectionHeading,
  Card,
  Badge,
  EmptyState,
  Figure,
  formatInr,
  buttonStyles,
} from "@/components/ui";

export default async function TripPage(props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await props.params;

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      groupMembers: { include: { user: true } },
      itineraryDays: {
        orderBy: { dayNumber: "asc" },
        include: { items: { orderBy: { order: "asc" } } },
      },
    },
  });

  if (!trip) redirect("/dashboard");

  const isMember = trip.groupMembers.some(
    (m) => m.userId === session.user!.id,
  );
  if (!isMember) redirect("/dashboard");

  const totalCost = trip.itineraryDays.reduce(
    (sum, day) =>
      sum + day.items.reduce((daySum, item) => daySum + item.estimatedCostInr, 0),
    0,
  );

  return (
    <PageShell>
      <PageHeader
        backHref="/dashboard"
        backLabel="Dashboard"
        title={trip.title}
        subtitle={trip.destination}
        meta={
          <>
            <span>
              <Figure>{new Date(trip.startDate).toLocaleDateString()}</Figure>{" "}
              &ndash;{" "}
              <Figure>{new Date(trip.endDate).toLocaleDateString()}</Figure>
            </span>
            <span>
              Budget{" "}
              <Figure className="text-ink-700 font-medium">
                {formatInr(trip.budgetInr)}
              </Figure>
            </span>
            <span className="capitalize">{trip.paceLevel} pace</span>
          </>
        }
      />

      <div className="mb-8">
        <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-ink-500 mb-2">
          Members
        </p>
        <div className="flex flex-wrap gap-2">
          {trip.groupMembers.map((m) => (
            <Badge key={m.id} tone="neutral" className="px-3 py-1">
              {m.user.name}
              {m.role === "creator" && (
                <span className="text-ink-400 ml-1">(creator)</span>
              )}
            </Badge>
          ))}
        </div>
      </div>

      <SectionHeading
        actions={
          <>
            <Link
              href={`/trips/${trip.id}/packing`}
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              Packing
            </Link>
            <Link
              href={`/trips/${trip.id}/stay`}
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              Stay
            </Link>
            {trip.itineraryDays.length > 0 && (
              <>
                <Link
                  href={`/trips/${trip.id}/route`}
                  className={buttonStyles({ variant: "secondary", size: "sm" })}
                >
                  Route
                </Link>
                <Link
                  href={`/trips/${trip.id}/budget`}
                  className={buttonStyles({ variant: "secondary", size: "sm" })}
                >
                  Budget
                </Link>
              </>
            )}
            <GenerateButton tripId={trip.id} />
          </>
        }
      >
        Itinerary
      </SectionHeading>

      {trip.itineraryDays.length === 0 ? (
        <EmptyState
          title="No itinerary generated yet"
          hint={'Click "Generate Itinerary" to create one.'}
        />
      ) : (
        <div className="space-y-10">
          <p className="text-[0.8125rem] text-ink-500">
            Estimated total{" "}
            <Figure className="text-ink-700 font-medium">
              {formatInr(totalCost)}
            </Figure>{" "}
            of <Figure>{formatInr(trip.budgetInr)}</Figure> budget
          </p>

          {trip.itineraryDays.map((day) => (
            <section key={day.id}>
              <h3 className="font-display text-lg font-semibold text-ink-800 mb-3">
                Day {day.dayNumber}
                <span className="text-ink-500 font-sans text-[0.875rem] font-normal ml-2">
                  {new Date(day.date).toLocaleDateString("en-IN", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </h3>

              <div className="space-y-3">
                {day.items.map((item) => (
                  <Card key={item.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <Figure className="text-[0.75rem] text-ink-500">
                          {item.startTime} &ndash; {item.endTime}
                        </Figure>
                        <h4 className="font-medium text-ink-900 mt-0.5">
                          {item.title}
                        </h4>
                        <p className="text-[0.875rem] text-ink-600 mt-1">
                          {item.description}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge tone="lagoon" className="capitalize">
                          {item.category}
                        </Badge>
                        <p className="mt-1.5">
                          <Figure className="text-[0.875rem] text-ink-700 font-medium">
                            {formatInr(item.estimatedCostInr)}
                          </Figure>
                        </p>
                      </div>
                    </div>

                    <p className="text-[0.75rem] text-ink-400 italic mt-3 pt-3 border-t border-ink-100">
                      {item.reasoning}
                    </p>

                    <ReplanPanel
                      tripId={trip.id}
                      dayNumber={day.dayNumber}
                      itemId={item.id}
                      itemTitle={item.title}
                    />
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </PageShell>
  );
}
