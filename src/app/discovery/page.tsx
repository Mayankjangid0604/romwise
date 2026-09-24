import { redirect } from "next/navigation";
import Link from "next/link";
import {
  PageShell,
  PageHeader,
  Card,
  Alert,
  SectionHeading,
  Badge,
  DiscoveryImage,
} from "@/components/ui";
import { COLLECTIONS, getDestinationsForCollection, CollectionTheme, RecommendedDestination } from "@/lib/destination-brain";
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
      {!activeCollection ? (
        <>
          <PageHeader
            backHref="/dashboard"
            backLabel="Dashboard"
            title="Discover Destinations"
            subtitle="Search for a specific destination or explore by travel style."
          />

          <DestinationSearch />

          <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
            <SectionHeading>Explore by Travel Style</SectionHeading>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
              {Object.values(COLLECTIONS).map((c) => (
                <Link
                  key={c.id}
                  href={`/discovery?collection=${c.id}`}
                  className="group relative h-48 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-ink-200"
                >
                  <DiscoveryImage 
                    src={c.imageUrl} 
                    alt={c.title} 
                    theme={c.id}
                    fill
                    className="group-hover:scale-105 transition-transform duration-700 object-cover" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-900/90 via-ink-900/40 to-transparent" />
                  <div className="absolute bottom-0 left-0 p-4 w-full">
                    <h3 className="font-display font-semibold text-white text-lg">{c.title}</h3>
                    <p className="text-[0.8125rem] text-ink-200 mt-1 line-clamp-2">{c.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
          {/* Collection Hero */}
          <div className="relative h-64 md:h-80 rounded-2xl overflow-hidden mb-8 shadow-sm">
            <DiscoveryImage 
              src={activeCollection.imageUrl} 
              alt={activeCollection.title} 
              theme={activeCollection.id}
              fill
              className="object-cover" 
            />
            <div className="absolute inset-0 bg-ink-900/40" />
            <div className="absolute inset-0 p-8 flex flex-col justify-end">
              <Link href="/discovery" className="text-white/80 hover:text-white flex items-center gap-2 mb-4 text-sm font-medium w-fit bg-black/20 px-3 py-1.5 rounded-full backdrop-blur-md">
                ← Back to all styles
              </Link>
              <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-2 shadow-sm">{activeCollection.title}</h1>
              <p className="text-white/90 max-w-2xl text-lg text-balance drop-shadow-sm">{activeCollection.description}</p>
            </div>
          </div>

          <DestinationSearch />

          {results && results.length > 0 ? (
            <div className="mt-8 space-y-12">
              {/* Major Destinations Tier */}
              {results.filter(r => r.tier === 'major').length > 0 && (
                <section>
                  <SectionHeading>Top {activeCollection.title} Destinations</SectionHeading>
                  <p className="text-ink-500 mb-4 text-sm">Major popular destinations with high coverage.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {results.filter(r => r.tier === 'major').map(dest => renderDestinationCard(dest))}
                  </div>
                </section>
              )}

              {/* Strong Matches Tier */}
              {results.filter(r => r.tier === 'strong').length > 0 && (
                <section>
                  <SectionHeading>Strong Matches</SectionHeading>
                  <p className="text-ink-500 mb-4 text-sm">Great alternatives with solid options.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {results.filter(r => r.tier === 'strong').map(dest => renderDestinationCard(dest))}
                  </div>
                </section>
              )}

              {/* Hidden Gems Tier */}
              {results.filter(r => r.tier === 'hidden').length > 0 && (
                <section>
                  <SectionHeading>Hidden Gems</SectionHeading>
                  <p className="text-ink-500 mb-4 text-sm">Offbeat or smaller destinations matching this vibe.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {results.filter(r => r.tier === 'hidden').map(dest => renderDestinationCard(dest))}
                  </div>
                </section>
              )}
            </div>
          ) : (
            <Alert tone="info" title="No results found" className="mt-8">
              We couldn&apos;t find any destinations matching this style with sufficient data.
            </Alert>
          )}
        </div>
      )}
    </PageShell>
  );
}

function renderDestinationCard(dest: RecommendedDestination) {
  return (
    <Card key={dest.id} className="flex flex-col overflow-hidden p-0 border-ink-200">
      <div className="h-48 relative overflow-hidden bg-ink-100 shrink-0">
        <DiscoveryImage 
          src={dest.imageUrl} 
          alt={dest.name} 
          fill
          className="object-cover" 
        />
      </div>
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-xl font-semibold text-ink-900">
              {dest.name}
            </h3>
            <p className="text-[0.875rem] text-ink-500">{dest.state}</p>
          </div>
          <Badge tone="lagoon" className="shrink-0 px-3 py-1 shadow-sm">
            <span className="font-mono tabular">{dest.matchScore}%</span>
            <span className="ml-1">match</span>
          </Badge>
        </div>

        <div className="mt-4 flex-1">
          <ul className="space-y-1.5">
            {dest.reasons.map((reason: string, i: number) => (
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
            className="inline-flex items-center justify-center rounded-control bg-lagoon-600 text-white font-medium text-[0.875rem] px-5 py-2 hover:bg-lagoon-700 transition-colors shadow-sm"
          >
            Plan this trip
          </Link>
        </div>
      </div>
    </Card>
  );
}
