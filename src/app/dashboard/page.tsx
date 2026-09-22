import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { formatTripDates } from "@/lib/date-utils";
import { Map, MapPin, Compass, Heart, Plus, Calendar, Clock, ArrowRight, Plane, CalendarDays, Wallet } from "lucide-react";
import {
  PageShell,
  Card,
  Badge,
  Figure,
  formatInr,
  buttonStyles,
} from "@/components/ui";
import { TRIP_TEMPLATES } from "@/lib/trip-templates";
import { TemplateCard } from "@/components/ui/template-card";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [trips, recentActivitiesRaw] = await Promise.all([
    prisma.trip.findMany({
      where: { creatorId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        itineraryDays: { select: { id: true } },
        groupMembers: { select: { id: true } },
      },
    }),
    prisma.recentActivity.findMany({
      where: { userId: session.user.id, type: "VIEW_TRIP", tripId: { not: null } },
      orderBy: { viewedAt: "desc" },
      take: 20,
    })
  ]);

  // De-duplicate redundant logs in UI
  const uniqueTripIds = Array.from(new Set(recentActivitiesRaw.map(r => r.tripId as string).filter(Boolean))).slice(0, 3);
  const recentTripsData = await prisma.trip.findMany({
    where: { id: { in: uniqueTripIds } }
  });

  const recentActivities = uniqueTripIds.map(id => {
    const activity = recentActivitiesRaw.find(a => a.tripId === id)!;
    return {
      ...activity,
      trip: recentTripsData.find(t => t.id === id)
    };
  });

  const now = new Date();
  
  // Categorize trips
  const scheduledTrips = trips.filter(t => t.startDate).sort((a, b) => a.startDate!.getTime() - b.startDate!.getTime());
  const futureTrips = scheduledTrips.filter(t => t.endDate ? t.endDate >= now : t.startDate! >= now);
  
  const upcomingTrip = futureTrips.length > 0 ? futureTrips[0] : null;
  const otherTrips = trips.filter(t => t.id !== upcomingTrip?.id);

  // Stats
  const totalItineraryDays = trips.reduce((s, t) => s + t.itineraryDays.length, 0);
  const totalBudget = trips.reduce((s, t) => s + t.budgetInr, 0);
  const totalMembers = trips.reduce((s, t) => s + t.groupMembers.length, 0);

  return (
    <PageShell width="default" className="max-w-7xl">
      <div className="py-6 space-y-10 animate-fade-up">
        
        {/* Top Section: Welcome & Quick Actions */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-display font-bold text-ink-900 tracking-tight">
              Welcome back, {session.user.name?.split(' ')[0] || 'Traveler'}
            </h1>
            <p className="text-ink-600 mt-2 text-lg">
              Where to next?
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/trips/new" className={buttonStyles({ className: "gap-2 shadow-sm shadow-lagoon-200" })}>
              <Plus className="w-4 h-4" />
              Plan a trip
            </Link>
            <Link href="/discovery" className={buttonStyles({ variant: "secondary", className: "gap-2" })}>
              <Compass className="w-4 h-4 text-ink-500" />
              Discover
            </Link>
          </div>
        </div>

        {/* Stats Row */}
        {trips.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Trips", value: trips.length.toString(), icon: Plane, color: "bg-lagoon-50 text-lagoon-600" },
              { label: "Upcoming", value: futureTrips.length.toString(), icon: Calendar, color: "bg-ember-50 text-ember-600" },
              { label: "Itinerary Days", value: totalItineraryDays.toString(), icon: CalendarDays, color: "bg-success-50 text-success-600" },
              { label: "Total Budget", value: `₹${(totalBudget / 1000).toFixed(0)}k`, icon: Wallet, color: "bg-caution-50 text-caution-600" },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label} className="p-4 bg-white">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-ink-900 tabular">{value}</p>
                    <p className="text-xs text-ink-500 font-medium">{label}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Hero Section: Upcoming Trip */}
        {upcomingTrip ? (
          <section>
            <h2 className="text-sm font-semibold text-ink-500 uppercase tracking-wider mb-4">Upcoming Trip</h2>
            <Link href={`/trips/${upcomingTrip.id}`} className="block group">
              <div className="relative overflow-hidden rounded-2xl bg-lagoon-900 border border-lagoon-800 shadow-xl shadow-lagoon-900/10 transition-transform group-hover:-translate-y-1 duration-300">
                <div className="absolute inset-0 bg-[url('/globe-pattern.svg')] opacity-10 bg-repeat bg-center mix-blend-overlay"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-lagoon-950/80 to-transparent"></div>
                <div className="relative p-6 sm:p-8 md:p-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div>
                    <Badge tone="lagoon" className="bg-lagoon-500/20 text-lagoon-100 border-lagoon-500/30 mb-4 inline-flex backdrop-blur-md">
                      Next Adventure
                    </Badge>
                    <h3 className="text-3xl sm:text-4xl font-display font-bold text-white mb-2">
                      {upcomingTrip.title}
                    </h3>
                    <div className="flex items-center text-lagoon-100 gap-2">
                      <MapPin className="w-5 h-5 text-lagoon-300" />
                      <span className="text-lg">{upcomingTrip.destination}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-4 min-w-[200px] shrink-0 bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/10">
                    <div className="flex items-center gap-3 text-white">
                      <Calendar className="w-5 h-5 text-lagoon-300" />
                      <div className="text-sm">
                        <div className="text-lagoon-200 font-medium text-xs uppercase tracking-wider mb-0.5">Dates</div>
                        <div className="font-semibold">{formatTripDates(upcomingTrip) || 'Unscheduled'}</div>
                      </div>
                    </div>
                    <div className="h-px w-full bg-white/10"></div>
                    <div className="flex items-center gap-3 text-white">
                      <Clock className="w-5 h-5 text-lagoon-300" />
                      <div className="text-sm">
                        <div className="text-lagoon-200 font-medium text-xs uppercase tracking-wider mb-0.5">Countdown</div>
                        <div className="font-semibold">
                          {upcomingTrip.startDate ? (
                            Math.ceil((upcomingTrip.startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) + ' days left'
                          ) : 'No date set'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </section>
        ) : (
          <section className="bg-lagoon-50/50 border border-lagoon-100 rounded-2xl p-8 text-center flex flex-col items-center justify-center min-h-[240px]">
            <div className="w-16 h-16 rounded-full bg-lagoon-100 flex items-center justify-center mb-4 text-lagoon-600">
              <Map className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-display font-bold text-ink-900 mb-2">Ready for a getaway?</h2>
            <p className="text-ink-600 max-w-md mx-auto mb-6">You have no upcoming trips planned. Start exploring destinations or craft your perfect itinerary with AI.</p>
            <Link href="/trips/new" className={buttonStyles({ className: "gap-2" })}>
              <Plus className="w-4 h-4" />
              Plan a trip
            </Link>
          </section>
        )}

        <section className="mt-12 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold text-ink-500 uppercase tracking-wider">
              Quick Start Templates
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {TRIP_TEMPLATES.map(template => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Column: All other trips */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-sm font-semibold text-ink-500 uppercase tracking-wider">
              {upcomingTrip ? "Other Trips" : "Your Trips"}
            </h2>
            
            {otherTrips.length === 0 ? (
              <p className="text-ink-500 text-sm">No other trips found.</p>
            ) : (
              <div className="space-y-3">
                {otherTrips.map((trip) => (
                  <Link key={trip.id} href={`/trips/${trip.id}`} className="block group">
                    <Card interactive className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-display text-lg font-semibold text-ink-900 group-hover:text-lagoon-700 transition-colors">
                          {trip.title}
                        </h3>
                        <p className="text-ink-500 text-sm mt-1 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" />
                          {trip.destination}
                        </p>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-600 sm:text-right">
                        <div>
                          <div className="text-ink-400 text-xs font-medium uppercase tracking-wider mb-0.5">Dates</div>
                          <Figure>{formatTripDates(trip) || 'Unscheduled'}</Figure>
                        </div>
                        <Badge tone="lagoon" className="capitalize">
                          {trip.paceLevel}
                        </Badge>
                        <ArrowRight className="w-4 h-4 text-ink-300 hidden sm:block group-hover:text-lagoon-500 group-hover:translate-x-1 transition-all" />
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar Column: Recently Viewed */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-500 uppercase tracking-wider">Recently Viewed</h2>
            </div>
            
            {recentActivities.some(a => a.trip) ? (
              <div className="space-y-3">
                {recentActivities.map((activity) => activity.trip && (
                  <Link key={activity.id} href={`/trips/${activity.trip.id}`} className="block group">
                    <Card className="p-4 hover:border-lagoon-200 hover:shadow-sm transition-all h-full bg-white/50 backdrop-blur-sm">
                      <h3 className="font-semibold text-sm text-ink-900 line-clamp-1 group-hover:text-lagoon-700 transition-colors">
                        {activity.trip.title}
                      </h3>
                      <p className="text-xs text-ink-500 mt-1.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTripDates(activity.trip) || 'Unscheduled'}
                      </p>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <Card className="p-6 text-center border-dashed bg-transparent">
                <p className="text-sm text-ink-500">No recently viewed trips.</p>
              </Card>
            )}

            <Card className="p-5 mt-6 bg-amber-50/50 border-amber-100">
              <div className="flex items-center gap-2 text-amber-700 font-semibold mb-2">
                <Heart className="w-4 h-4 fill-current" />
                Favorites
              </div>
              <p className="text-sm text-amber-900/70 mb-4">
                Access your saved places, restaurants, and notes.
              </p>
              <Link href="/dashboard/favorites" className={buttonStyles({ variant: "secondary", size: "sm", className: "w-full text-amber-700 hover:bg-amber-100/50" })}>
                View Favorites
              </Link>
            </Card>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
