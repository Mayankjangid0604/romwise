"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { PlaceCard, Button, Input, Select } from "@/components/ui";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { togglePlaceSelection } from "@/app/actions/place-selections";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export type PlaceSelectionStatus = "must-visit" | "interested" | "exclude" | null;

export type PlaceDTO = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  area: string | null;
  typicalCostInr: number | null;
  durationMinutes: number | null;
  accessibilityScore: number | null;
  fatigueCost: number | null;
  selectionStatus: PlaceSelectionStatus;
};

export function PlaceBrowser({ 
  tripId, 
  initialPlaces, 
  categories,
  initialSearch,
  initialCategory,
  initialStatus,
  currentPage,
  totalPages
}: { 
  tripId: string; 
  initialPlaces: PlaceDTO[]; 
  categories: string[];
  initialSearch: string;
  initialCategory: string;
  initialStatus: string;
  currentPage: number;
  totalPages: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [places, setPlaces] = useState<PlaceDTO[]>(initialPlaces);
  const [prevInitialPlaces, setPrevInitialPlaces] = useState<PlaceDTO[]>(initialPlaces);
  const [search, setSearch] = useState(initialSearch);
  const [isPending, startTransition] = useTransition();

  if (initialPlaces !== prevInitialPlaces) {
    setPrevInitialPlaces(initialPlaces);
    setPlaces(initialPlaces);
  }

  const updateUrl = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }, [pathname, router, searchParams]);

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      if (search !== initialSearch) {
        updateUrl({ q: search || null, page: "1" });
      }
    }, 400);
    return () => clearTimeout(handler);
  }, [search, initialSearch, updateUrl]);

  const handleToggle = (placeId: string, status: PlaceSelectionStatus) => {
    startTransition(async () => {
      // Optimistic update
      setPlaces(prev => prev.map(p => 
        p.id === placeId ? { ...p, selectionStatus: status } : p
      ));
      
      try {
        await togglePlaceSelection(tripId, placeId, status);
      } catch (err) {
        // Revert on error
        setPlaces(initialPlaces);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl border border-ink-200 opacity-100 transition-opacity" style={{ opacity: isPending ? 0.7 : 1 }}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-400" />
          <Input 
            placeholder="Search places..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select 
          value={initialCategory} 
          onChange={(e) => updateUrl({ category: e.target.value === "all" ? null : e.target.value, page: "1" })}
          className="sm:w-48"
        >
          <option value="all">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select 
          value={initialStatus} 
          onChange={(e) => updateUrl({ status: e.target.value === "all" ? null : e.target.value, page: "1" })}
          className="sm:w-48"
        >
          <option value="all">All Statuses</option>
          <option value="none">Unselected</option>
          <option value="must-visit">Must-Visit</option>
          <option value="interested">Interested</option>
          <option value="exclude">Excluded</option>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" style={{ opacity: isPending ? 0.7 : 1 }}>
        {places.map(place => (
          <PlaceCard
            key={place.id}
            title={place.name}
            category={place.category}
            description={place.description}
            address={place.area}
            costEstimate={place.typicalCostInr}
            duration={place.durationMinutes ? `${place.durationMinutes} min` : undefined}
            accessibilityScore={place.accessibilityScore}
            fatigueCost={place.fatigueCost}
            className="bg-white"
          >
            <div className="mt-4 pt-4 border-t border-ink-100 flex items-center gap-2">
              <Button 
                variant={place.selectionStatus === "must-visit" ? "primary" : "secondary"}
                size="sm"
                onClick={() => handleToggle(place.id, place.selectionStatus === "must-visit" ? null : "must-visit")}
                className="flex-1 text-[0.6875rem]"
              >
                Must-Visit
              </Button>
              <Button 
                variant={place.selectionStatus === "interested" ? "primary" : "secondary"}
                size="sm"
                onClick={() => handleToggle(place.id, place.selectionStatus === "interested" ? null : "interested")}
                className="flex-1 text-[0.6875rem]"
              >
                Interested
              </Button>
              <Button 
                variant={place.selectionStatus === "exclude" ? "primary" : "secondary"}
                size="sm"
                onClick={() => handleToggle(place.id, place.selectionStatus === "exclude" ? null : "exclude")}
                className="flex-1 text-[0.6875rem]"
              >
                Exclude
              </Button>
            </div>
          </PlaceCard>
        ))}
      </div>
      
      {places.length === 0 && (
        <div className="text-center py-12 text-ink-500">
          No places found matching your filters.
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-6 border-t border-ink-100">
          <p className="text-sm text-ink-500">Page {currentPage} of {totalPages}</p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={currentPage <= 1}
              onClick={() => updateUrl({ page: String(currentPage - 1) })}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Prev
            </Button>
            <Button
              variant="secondary"
              disabled={currentPage >= totalPages}
              onClick={() => updateUrl({ page: String(currentPage + 1) })}
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
