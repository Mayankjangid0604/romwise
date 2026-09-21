import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { PageShell, PageHeader, EmptyState, PlaceCard } from "@/components/ui";
import { FavoriteButton } from "@/components/ui/favorite-button";

export default async function FavoritesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [favPlaces, favDestinations] = await Promise.all([
    prisma.favoritePlace.findMany({
      where: { userId: session.user.id },
      include: { place: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.favoriteDestination.findMany({
      where: { userId: session.user.id },
      include: { destination: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <PageShell>
      <PageHeader 
        title="Favorites" 
        subtitle="Places and destinations you've saved for later." 
        backHref="/dashboard"
        backLabel="Dashboard"
      />

      {favPlaces.length === 0 && favDestinations.length === 0 ? (
        <EmptyState 
          title="No favorites yet"
          hint="When you find a place or destination you like, tap the heart icon to save it here."
        />
      ) : (
        <div className="space-y-12">
          {favPlaces.length > 0 && (
            <section>
              <h2 className="text-xl font-display font-semibold text-ink-900 mb-6">Saved Places</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {favPlaces.map((fp) => (
                  <PlaceCard
                    key={fp.id}
                    title={fp.place.name}
                    category={fp.place.category || "Place"}
                    address={fp.place.area}
                    isFavorite={true}
                    placeId={fp.placeId}
                  />
                ))}
              </div>
            </section>
          )}

          {favDestinations.length > 0 && (
            <section>
              <h2 className="text-xl font-display font-semibold text-ink-900 mb-6">Saved Destinations</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {favDestinations.map((fd) => (
                  <div key={fd.id} className="p-5 bg-white border border-ink-100 rounded-xl shadow-sm hover:shadow-md transition-shadow relative group">
                    <h3 className="text-lg font-semibold text-ink-900 mb-2 pr-8">{fd.destination.name}</h3>
                    <p className="text-sm text-ink-600 line-clamp-3">{fd.destination.description}</p>
                    <FavoriteButton 
                      id={fd.destinationId} 
                      type="destination" 
                      initialIsFavorite={true}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100"
                    />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </PageShell>
  );
}
