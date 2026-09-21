import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTripRole, requireTripRole } from "@/lib/security";
import { getActiveShares } from "@/app/actions/share";
import { redirect } from "next/navigation";
import { GroupDashboard } from "@/components/group/group-dashboard";

export default async function GroupPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const role = await getTripRole(id, session.user.id);
  if (!role) {
    redirect("/dashboard");
  }

  const trip = await prisma.trip.findUnique({
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
      }
    }
  });

  if (!trip) redirect("/dashboard");

  let activeShares: { id: string; role: string; token: string; }[] = [];
  if (role === "creator") {
    activeShares = await getActiveShares(id);
  }

  // Find the creator to add to the members list
  const creator = await prisma.user.findUnique({
    where: { id: trip.creatorId },
    select: { id: true, name: true, email: true },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Group & Collaboration</h1>
        <p className="text-muted-foreground mt-1">Manage who can view and edit this trip.</p>
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
