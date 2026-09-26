"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  CalendarDays,
  PackageCheck,
  Wallet,
  Route,
  SlidersHorizontal,
  Users,
  MapPin,
  BedDouble,
} from "lucide-react";

const tabs = [
  { label: "Overview", path: "", icon: LayoutGrid },
  { label: "Itinerary", path: "/itinerary", icon: CalendarDays },
  { label: "Packing", path: "/packing", icon: PackageCheck },
  { label: "Budget", path: "/budget", icon: Wallet },
  // Stay and Preferences existed but had no inbound link anywhere in the UI.
  { label: "Stay", path: "/stay", icon: BedDouble },
  { label: "Places", path: "/places", icon: MapPin },
  { label: "Route", path: "/route", icon: Route },
  // Replaces "Info" (/info was a "will be implemented here" placeholder; it now redirects here).
  { label: "Preferences", path: "/preferences", icon: SlidersHorizontal },
  { label: "Group", path: "/group", icon: Users },
];

export function TripWorkspaceNav({ tripId }: { tripId: string }) {
  const pathname = usePathname();
  const base = `/trips/${tripId}`;

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <nav className="flex gap-0.5 min-w-max">
        {tabs.map(({ label, path, icon: Icon }) => {
          const href = `${base}${path}`;
          // Exact match for overview, prefix match for others
          const active =
            path === ""
              ? pathname === base
              : pathname.startsWith(href);

          return (
            <Link
              key={path}
              href={href}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                active
                  ? "bg-lagoon-600 text-white shadow-sm"
                  : "text-ink-600 hover:bg-ink-100 hover:text-ink-800"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
