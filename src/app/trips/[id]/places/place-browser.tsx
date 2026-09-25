"use client";

import { useState, useTransition } from "react";
import { PlaceCard, Badge, Button, Input, Select } from "@/components/ui";
import { Search, Loader2 } from "lucide-react";
import { togglePlaceSelection } from "@/app/actions/place-selections";

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
  categories 
}: { 
  tripId: string; 
  initialPlaces: PlaceDTO[]; 
  categories: string[];
}) {
  const [places, setPlaces] = useState<PlaceDTO[]>(initialPlaces);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isPending, startTransition] = useTransition();

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

  const filteredPlaces = places.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !(p.description || "").toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (category !== "all" && p.category !== category) return false;
    if (statusFilter !== "all") {
      if (statusFilter === "none" && p.selectionStatus !== null) return false;
      if (statusFilter !== "none" && p.selectionStatus !== statusFilter) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl border border-ink-200">
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
          value={category} 
          onChange={(e) => setCategory(e.target.value)}
          className="sm:w-48"
        >
          <option value="all">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select 
          value={statusFilter} 
          onChange={(e) => setStatusFilter(e.target.value)}
          className="sm:w-48"
        >
          <option value="all">All Statuses</option>
          <option value="none">Unselected</option>
          <option value="must-visit">Must-Visit</option>
          <option value="interested">Interested</option>
          <option value="exclude">Excluded</option>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPlaces.map(place => (
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
      
      {filteredPlaces.length === 0 && (
        <div className="text-center py-12 text-ink-500">
          No places found matching your filters.
        </div>
      )}
    </div>
  );
}
