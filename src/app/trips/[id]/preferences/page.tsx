import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageShell, PageHeader, Card } from "@/components/ui";
import { PreferenceClient } from "./preference-client";

export default async function PreferencesPage(props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await props.params;

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      groupMembers: {
        where: { userId: session.user.id },
        include: { travelerPreferences: true },
      },
    },
  });

  if (!trip || trip.groupMembers.length === 0) {
    redirect("/dashboard");
  }

  const myMember = trip.groupMembers[0];

  return (
    <PageShell>
      <PageHeader
        backHref={`/trips/${trip.id}`}
        backLabel="Trip Details"
        title="My Preferences"
        subtitle={trip.title}
      />

      <div className="max-w-2xl mt-6">
        <Card>
          <div className="p-4 space-y-6">
            <div>
              <h2 className="text-lg font-medium text-ink-800">Travel Preferences</h2>
              <p className="text-sm text-ink-500 mt-1">
                Tell us what you love (and hate). Trip Brain uses these to score candidate places and filter out hard exclusions.
              </p>
            </div>
            
            <PreferenceClient 
              tripId={trip.id} 
              initialPreferences={myMember.travelerPreferences} 
            />
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
