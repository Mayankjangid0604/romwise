import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTripRole } from "@/lib/security";
import { redirect } from "next/navigation";
import { GroupDashboard } from "@/components/group/group-dashboard";

export default async function GroupPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Role, trip (+ creator) and share links load in parallel; these used to be ~8
  // sequential round trips (getActiveShares re-derived the role before querying).
  const [role, trip, shares] = await Promise.all([
    getTripRole(id, session.user.id),
    prisma.trip.findUnique({
      where: { id },
      include: {
        groupMembers: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              }
            }
          }
        },
        creator: { select: { id: true, name: true, email: true } },
      }
    }),
    prisma.tripShare.findMany({
      where: { tripId: id, active: true },
      select: { id: true, role: true, token: true },
    }),
  ]);

  if (!role) {
    redirect("/dashboard");
  }
  if (!trip) redirect("/dashboard");

  // Share tokens are only ever handed to the creator
  const activeShares = role === "creator" ? shares : [];
  const creator = trip.creator;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Group & Collaboration</h1>
        <p className="text-ink-500 mt-1">Manage who can view and edit this trip.</p>
      </div>

      <GroupDashboard
        tripId={id}
        role={role}
        creator={creator!}
        members={trip.groupMembers}
        activeShares={activeShares}
      />
    </div>
  );
}
