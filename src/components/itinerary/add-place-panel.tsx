"use client";

import { useState, useRef, useEffect, useId } from "react";
import { Search, Plus, MapPin, Check, X, Clock } from "lucide-react";
import { addItineraryItem, listAddablePlaces, type AddablePlace } from "@/app/actions/itinerary";
import { useDebounce } from "@/hooks/use-debounce";
import { Input, Button, Badge, Select, Figure, formatInr, cn } from "@/components/ui";

export type AddPlaceDay = { id: string; dayNumber: number; label: string };

type Status = { tone: "success" | "danger"; text: string } | null;

/**
 * Lets a member insert extra places into an already-generated itinerary.
 *
 * Opens on a list of suggested places (popular, not yet scheduled) so the user
 * can pick without typing; typing 2+ characters searches name / area / category.
 *
 * - `presentation="inline"`: sits under a day's timeline, adds to that day.
 * - `presentation="dialog"`: toolbar button → modal with a day picker.
 */
export function AddPlacePanel({
  tripId,
  days,
  initialDayId,
  presentation = "inline",
}: {
  tripId: string;
  days: AddPlaceDay[];
  initialDayId?: string;
  presentation?: "inline" | "dialog";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [dayId, setDayId] = useState(initialDayId ?? days[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AddablePlace[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Status>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const headingId = useId();

  const debouncedQuery = useDebounce(query, 250);
  const trimmedQuery = debouncedQuery.trim();
  const isSearching = trimmedQuery.length >= 2;
  const selectedDay = days.find((d) => d.id === dayId);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const places = await listAddablePlaces(tripId, isSearching ? trimmedQuery : "");
        if (!cancelled) setResults(places);
      } catch (err) {
        console.error("Failed to load places:", err);
        if (!cancelled) setStatus({ tone: "danger", text: "Couldn't load places. Please try again." });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, isSearching, trimmedQuery, tripId]);

  // Inline: close when clicking elsewhere. Dialog: close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (presentation === "inline" && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, presentation]);

  function open() {
    setStatus(null);
    setIsOpen(true);
  }

  async function handleAdd(place?: AddablePlace) {
    if (addingId || !dayId) return;
    setAddingId(place?.id ?? "custom");
    setStatus(null);
    try {
      const res = await addItineraryItem(tripId, dayId, place?.id);
      if (!res.success) {
        setStatus({ tone: "danger", text: res.error });
        return;
      }
      const name = place?.name ?? "Custom activity";
      setStatus({
        tone: "success",
        text: `Added ${name} to Day ${res.dayNumber} (${res.startTime}–${res.endTime}).`,
      });
      if (place) setAddedIds((prev) => new Set(prev).add(place.id));
    } catch (err) {
      console.error(err);
      setStatus({ tone: "danger", text: "Failed to add this place. Please try again." });
    } finally {
      setAddingId(null);
    }
  }

  const visibleResults = results.filter((p) => !addedIds.has(p.id));

  if (!isOpen) {
    return presentation === "dialog" ? (
      <Button size="sm" onClick={open} disabled={days.length === 0}>
        <Plus className="w-4 h-4" /> Add place
      </Button>
    ) : (
      <div className="mt-4 flex justify-center">
        <button
          type="button"
          onClick={open}
          className="text-[0.875rem] font-medium text-lagoon-600 hover:text-lagoon-800 flex items-center gap-1 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add place to {selectedDay?.label ?? "this day"}
        </button>
      </div>
    );
  }

  const panel = (
    <div
      ref={containerRef}
      role={presentation === "dialog" ? "dialog" : "region"}
      aria-modal={presentation === "dialog" ? true : undefined}
      aria-labelledby={headingId}
      className={cn(
        "bg-white rounded-xl shadow-lg border border-ink-100 overflow-hidden p-4 w-full",
        presentation === "dialog" ? "max-w-xl" : "max-w-lg mx-auto",
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 id={headingId} className="font-semibold text-ink-900 text-[0.9375rem]">
          Add a place
        </h3>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Close"
          className="p-1 rounded-md text-ink-400 hover:text-ink-700 hover:bg-ink-100"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {presentation === "dialog" && days.length > 1 && (
        <label className="flex items-center gap-2 text-[0.8125rem] text-ink-600 mb-3">
          <span className="whitespace-nowrap">Add to</span>
          <Select
            aria-label="Day to add the place to"
            value={dayId}
            onChange={(e) => setDayId(e.target.value)}
            className="h-9 w-auto"
          >
            {days.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </Select>
        </label>
      )}

      <div className="relative mb-3">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-ink-400" />
        </div>
        <Input
          autoFocus
          type="search"
          aria-label="Search places"
          className="pl-9"
          placeholder="Search by name, area or type (e.g. fort, bazaar)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <p className="text-[0.75rem] font-medium uppercase tracking-wider text-ink-400 mb-1">
        {isSearching ? `Results for “${trimmedQuery}”` : "Suggested — popular places not in your plan yet"}
      </p>

      <div className="max-h-72 overflow-y-auto -mx-4 border-t border-ink-50">
        {isLoading && visibleResults.length === 0 ? (
          <div className="p-4 text-sm text-center text-ink-500">Loading places…</div>
        ) : visibleResults.length > 0 ? (
          <ul className="divide-y divide-ink-50" aria-busy={isLoading}>
            {visibleResults.map((place) => (
              <li key={place.id} className="px-4 py-3 flex items-start gap-3">
                <MapPin className="h-4 w-4 text-lagoon-600 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-ink-900 text-sm">{place.name}</span>
                    <Badge tone="neutral" className="capitalize">
                      {place.category.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="text-xs text-ink-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    {place.area && <span>{place.area}</span>}
                    {place.typicalCostInr != null && (
                      <Figure>{place.typicalCostInr === 0 ? "Free" : formatInr(place.typicalCostInr)}</Figure>
                    )}
                    {place.durationMinutes != null && (
                      <span className="inline-flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />
                        <Figure>{place.durationMinutes} min</Figure>
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleAdd(place)}
                  disabled={addingId !== null}
                  aria-label={`Add ${place.name} to ${selectedDay?.label ?? "this day"}`}
                >
                  {addingId === place.id ? "Adding…" : "Add"}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-4 text-sm text-center text-ink-500">
            {isSearching ? "No matching places for this destination." : "Every known place for this destination is already in your plan."}
          </div>
        )}
      </div>

      <p aria-live="polite" className="min-h-[1.25rem] mt-3 text-[0.8125rem]">
        {status && (
          <span className={cn("inline-flex items-center gap-1", status.tone === "success" ? "text-success-700" : "text-danger-700")}>
            {status.tone === "success" && <Check className="w-4 h-4" />}
            {status.text}
          </span>
        )}
      </p>

      <div className="mt-2 pt-3 border-t border-ink-100 flex justify-between items-center">
        <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
          Done
        </Button>
        <Button variant="secondary" size="sm" onClick={() => handleAdd()} disabled={addingId !== null}>
          Add custom activity
        </Button>
      </div>
    </div>
  );

  if (presentation === "dialog") {
    return (
      <div
        className="fixed inset-0 z-[60] bg-ink-900/40 flex items-start justify-center p-4 pt-24 overflow-y-auto"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) setIsOpen(false);
        }}
      >
        {panel}
      </div>
    );
  }

  return <div className="mt-4 relative z-10">{panel}</div>;
}
