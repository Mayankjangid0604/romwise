import Link from "next/link";
import { TripWorkspaceNav } from "@/components/ui";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { LayoutGrid } from "lucide-react";
import { AICopilot } from "./ai-copilot";

// Note: AppShell + AppNavigation are already provided by the parent trips/layout.tsx.
// This layout only adds the trip-specific tab bar and content wrapper.
export default async function TripLayout(props: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const session = await auth();

  const trip = session?.user?.id
    ? await prisma.trip.findFirst({
        where: { id, groupMembers: { some: { userId: session.user.id } } },
        select: { title: true, destination: true },
      })
    : null;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Trip workspace tab bar — sticky below the global nav (top-16) */}
      <div className="bg-white border-b border-ink-200 sticky top-16 z-40 px-4 sm:px-6 py-3">
        {trip && (
          <div className="flex items-center gap-2 text-xs text-ink-500 mb-2.5">
            <Link href="/dashboard" className="hover:text-lagoon-600 transition-colors">
              Dashboard
            </Link>
            <span className="text-ink-300">/</span>
            <LayoutGrid className="w-3.5 h-3.5 text-ink-400" />
            <span className="font-medium text-ink-700 truncate max-w-[200px]">
              {trip.title}
            </span>
            <span className="ml-1 text-ink-400">· {trip.destination}</span>
          </div>
        )}
        <TripWorkspaceNav tripId={id} />
      </div>
      {/* Page content */}
      <div className="flex-1 bg-ink-50 p-4 sm:p-6">
        {props.children}
      </div>
      <AICopilot tripId={id} />
    </div>
  );
}
