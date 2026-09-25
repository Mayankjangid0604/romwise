"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Plus, MapPin } from "lucide-react";
import { addItineraryItem, searchPlacesForTrip } from "@/app/actions/itinerary";
import { useDebounce } from "@/hooks/use-debounce";
import { Input, Button } from "@/components/ui";

interface PlaceResult {
  id: string;
  name: string;
  category: string;
  description: string | null;
}

export function AddActivityButton({ tripId, dayId }: { tripId: string; dayId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    async function fetchResults() {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        setResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const places = await searchPlacesForTrip(tripId, debouncedQuery);
        setResults(places);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }
    fetchResults();
  }, [debouncedQuery, tripId]);

  async function handleAdd(placeId?: string) {
    if (isAdding) return;
    setIsAdding(true);
    try {
      const res = await addItineraryItem(tripId, dayId, placeId);
      if (!res.success) {
        alert(res.error);
      }
      setIsOpen(false);
      setQuery("");
    } catch (err) {
      console.error(err);
      alert("Failed to add activity");
    } finally {
      setIsAdding(false);
    }
  }

  if (!isOpen) {
    return (
      <div className="mt-4 flex justify-center">
        <button
          onClick={() => setIsOpen(true)}
          className="text-[0.875rem] font-medium text-lagoon-600 hover:text-lagoon-800 flex items-center gap-1 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Activity
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 relative z-10" ref={containerRef}>
      <div className="bg-white rounded-xl shadow-lg border border-ink-100 overflow-hidden max-w-lg mx-auto p-4">
        <div className="relative mb-3">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-ink-400" />
          </div>
          <Input
            autoFocus
            type="search"
            className="pl-9"
            placeholder="Search for a place (e.g. Taj Mahal)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {query.length >= 2 ? (
          <div className="max-h-64 overflow-y-auto -mx-4 border-t border-ink-50">
            {isSearching ? (
              <div className="p-4 text-sm text-center text-ink-500">Searching...</div>
            ) : results.length > 0 ? (
              <ul className="divide-y divide-ink-50">
                {results.map((place) => (
                  <li key={place.id}>
                    <button
                      onClick={() => handleAdd(place.id)}
                      disabled={isAdding}
                      className="w-full text-left px-4 py-3 hover:bg-lagoon-50 transition-colors flex items-start gap-3 disabled:opacity-50"
                    >
                      <MapPin className="h-4 w-4 text-lagoon-600 mt-0.5 shrink-0" />
                      <div>
                        <div className="font-medium text-ink-900 text-sm">{place.name}</div>
                        <div className="text-xs text-ink-500 line-clamp-1">{place.description || place.category}</div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 text-sm text-center text-ink-500">No places found.</div>
            )}
          </div>
        ) : (
          <div className="p-4 text-xs text-center text-ink-400">
            Type at least 2 characters to search.
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-ink-100 flex justify-between items-center">
          <Button variant="secondary" size="sm" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={() => handleAdd()} 
            disabled={isAdding}
          >
            Add Custom Activity
          </Button>
        </div>
      </div>
    </div>
  );
}
