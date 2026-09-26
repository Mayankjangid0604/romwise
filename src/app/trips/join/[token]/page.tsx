import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Alert, CenteredShell, buttonStyles } from "@/components/ui";

/**
 * Invite link: /trips/join/<token>.
 *
 * This is a page (not a Route Handler) on purpose. After login/signup the auth
 * action redirects here via a client-side (RSC) navigation; a Route Handler's own
 * redirect was silently followed inside that fetch, so the trip rendered under the
 * stale /trips/join/<token> URL. A page-level redirect() goes through the router
 * and lands on /trips/<id> properly.
 */
export default async function JoinTripPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;

  const share = await prisma.tripShare.findUnique({
    where: { token, active: true },
  });

  if (!share) {
    return <JoinError title="Invalid invite link" message="This invite link is invalid or has been revoked. Ask the trip organiser for a new one." />;
  }

  if (share.expiresAt && share.expiresAt < new Date()) {
    return <JoinError title="Invite link expired" message="This invite link has expired. Ask the trip organiser for a new one." />;
  }

  const session = await auth();
  if (!session?.user?.id) {
    // Log in (or sign up), then come back here to finish joining
    redirect(`/login?callbackUrl=${encodeURIComponent(`/trips/join/${token}`)}`);
  }

  const trip = await prisma.trip.findUnique({
    where: { id: share.tripId },
    select: { id: true, creatorId: true },
  });

  if (!trip) {
    return <JoinError title="Trip not found" message="The trip for this invite no longer exists." />;
  }

  if (trip.creatorId !== session.user.id) {
    const existingMember = await prisma.groupMember.findUnique({
      where: { userId_tripId: { userId: session.user.id, tripId: share.tripId } },
      select: { id: true },
    });

    // Existing members (and the creator) just go to the trip; the invite doesn't change their role
    if (!existingMember) {
      await prisma.groupMember.create({
        data: {
          userId: session.user.id,
          tripId: share.tripId,
          role: share.role,
        },
      });
    }
  }

  redirect(`/trips/${share.tripId}`);
}

function JoinError({ title, message }: { title: string; message: string }) {
  return (
    <CenteredShell>
      <Alert tone="danger" title={title}>
        {message}
      </Alert>
      <Link href="/dashboard" className={buttonStyles({ variant: "secondary", className: "mt-4" })}>
        Go to dashboard
      </Link>
    </CenteredShell>
  );
}
