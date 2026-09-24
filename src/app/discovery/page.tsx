import { redirect } from "next/navigation";
import Link from "next/link";
import {
  PageShell,
  PageHeader,
  Card,
  Alert,
  SectionHeading,
  Badge,
} from "@/components/ui";
import { COLLECTIONS, getDestinationsForCollection, CollectionTheme } from "@/lib/destination-brain";
import { DestinationSearch } from "./DestinationSearch";

export default async function DiscoveryPage(props: {
  searchParams: Promise<{ collection?: string }>;
}) {
  const { collection: collectionParam } = await props.searchParams;

  const activeCollection = collectionParam 
    ? COLLECTIONS[collectionParam as CollectionTheme] 
    : null;

  const results = activeCollection 
    ? await getDestinationsForCollection({ theme: activeCollection.id as CollectionTheme }) 
    : null;

  return (
    <PageShell>
      <PageHeader
        backHref="/dashboard"
        backLabel="Dashboard"
        title="Discover Destinations"
        subtitle="Search for a specific destination or explore by travel style."
      />

      <DestinationSearch />

      {/* Collection Grid */}
      <div className="mb-10">
        <SectionHeading>Explore by Travel Style</SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
          {Object.values(COLLECTIONS).map((c) => (
            <Link
              key={c.id}
              href={`/discovery?collection=${c.id}`}
              className={`p-4 rounded-card border transition-all ${
                activeCollection?.id === c.id
                  ? "border-lagoon-600 bg-lagoon-50 shadow-sm"
                  : "border-ink-200 bg-white hover:border-lagoon-300 hover:shadow-sm"
              }`}
            >
              <h3 className="font-display font-semibold text-ink-900">{c.title}</h3>
              <p className="text-[0.8125rem] text-ink-600 mt-1">{c.description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Results */}
      {activeCollection && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
          <SectionHeading>{activeCollection.title} Destinations</SectionHeading>
          
          {results && results.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              {results.map((dest) => (
                <Card key={dest.id} className="flex flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-display text-xl font-semibold text-ink-900">
                        {dest.name}
                      </h3>
                      <p className="text-[0.875rem] text-ink-500">{dest.state}</p>
                    </div>
                    <Badge tone="lagoon" className="shrink-0 px-3 py-1">
                      <span className="font-mono tabular">{dest.matchScore}%</span>
                      <span className="ml-1">match</span>
                    </Badge>
                  </div>

                  <div className="mt-4 flex-1">
                    <ul className="space-y-1">
                      {dest.reasons.map((reason, i) => (
                        <li key={i} className="text-[0.875rem] text-ink-700 flex items-start gap-2">
                          <span className="text-lagoon-600 mt-0.5">•</span>
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-5 pt-4 border-t border-ink-100 flex items-center gap-4 justify-between">
                    <Link
                      href={`/trips/new?destination=${encodeURIComponent(dest.name)}`}
                      className="inline-flex items-center justify-center rounded-control bg-lagoon-600 text-white font-medium text-[0.875rem] px-4 py-2 hover:bg-lagoon-700 transition-colors"
                    >
                      Plan this trip
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Alert tone="info" title="No results found" className="mt-4">
              We couldn't find any destinations matching this style with sufficient data.
            </Alert>
          )}
        </div>
      )}
    </PageShell>
  );
}
