"use client";

import { useState } from "react";
import { createTrip } from "@/app/actions/trips";
import { DestinationSearch } from "@/app/discovery/DestinationSearch";
import { Card, Input, Button, Alert } from "@/components/ui";
import { Calendar, Wallet, Users, MapPin, Loader2 } from "lucide-react";
import type { DestinationDetails } from "@/lib/destination-brain/details";

export function TripBuilder({
  initialDestination,
  initialDetails,
  initialData,
}: {
  initialDestination: string;
  initialDetails: DestinationDetails | null;
  initialData?: { startDate?: string; endDate?: string; budget?: string; pace?: string; };
}) {
  const [destination, setDestination] = useState(initialDestination);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!destination) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-ink-900">Where do you want to go?</h2>
        <DestinationSearch />
      </div>
    );
  }

  const handleGenerate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsCreating(true);
    setError(null);

    try {
      const formData = new FormData(e.currentTarget);
      formData.append("destination", destination);
      formData.append("title", `Trip to ${destination}`);
      formData.append("dateStatus", "exact");
      formData.append("tripType", "MULTI_DAY");
      formData.append("autoGenerate", "true");

      const state = await createTrip({}, formData);
      if (state?.error || state?.fieldErrors) {
        setError(state.error || Object.values(state.fieldErrors || {})[0] || "Validation failed");
        setIsCreating(false);
      }
    } catch (err) {
      setError("Failed to create trip");
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-up">
      {initialDetails && (
        <Card className="p-6 bg-lagoon-50 border-lagoon-100 flex flex-col gap-2">
          <h2 className="text-2xl font-bold text-ink-900 flex items-center gap-2">
            <MapPin className="w-6 h-6 text-lagoon-600" /> {initialDetails.name}
          </h2>
          <p className="text-ink-600">{initialDetails.tagline}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-xs px-2 py-1 bg-white border border-ink-200 rounded-md">Vibe: {initialDetails.vibe}</span>
            <span className="text-xs px-2 py-1 bg-white border border-ink-200 rounded-md">Best months: {initialDetails.bestMonths.slice(0, 3).join(", ")}</span>
            <span className="text-xs px-2 py-1 bg-white border border-ink-200 rounded-md">Avg budget: ₹{initialDetails.averageDailyBudgetInr}/day</span>
          </div>
        </Card>
      )}

      {error && <Alert tone="danger">{error}</Alert>}

      <form onSubmit={handleGenerate} className="space-y-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-ink-900 mb-4">Trip Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-ink-700 flex items-center gap-1.5"><Calendar className="w-4 h-4"/> Start Date</label>
              <Input type="date" name="startDate" defaultValue={initialData?.startDate} required className="w-full" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-ink-700 flex items-center gap-1.5"><Calendar className="w-4 h-4"/> End Date</label>
              <Input type="date" name="endDate" defaultValue={initialData?.endDate} required className="w-full" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-ink-700 flex items-center gap-1.5"><Wallet className="w-4 h-4"/> Total Budget (₹)</label>
              <Input type="number" name="budget" defaultValue={initialData?.budget || (initialDetails ? initialDetails.averageDailyBudgetInr * 2 : 20000)} required min="1000" className="w-full" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-ink-700 flex items-center gap-1.5"><Users className="w-4 h-4"/> Travelers</label>
              <Input type="number" name="maxTravelers" defaultValue={2} required min="1" max="20" className="w-full" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-ink-700">Pace Level</label>
              <select name="paceLevel" className="w-full rounded-md border-ink-200 shadow-sm focus:border-lagoon-500 focus:ring-lagoon-500 text-sm py-2 px-3" defaultValue={initialData?.pace || "balanced"}>
                <option value="easy">Easy (Relaxed, fewer activities)</option>
                <option value="balanced">Balanced (Mix of chill and active)</option>
                <option value="full">Full (Action-packed, lots of walking)</option>
              </select>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-ink-900 mb-4">Accessibility & Preferences</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-ink-700">Accessibility Notes</label>
              <Input type="text" name="accessibilityNotes" placeholder="e.g. Wheelchair access needed, traveling with infant, vegan diet" className="w-full" />
            </div>
          </div>
        </Card>

        <Button type="submit" disabled={isCreating} className="w-full py-6 text-lg font-semibold rounded-xl bg-lagoon-600 hover:bg-lagoon-700 text-white shadow-lg">
          {isCreating ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Generating Your Trip...
            </span>
          ) : (
            "Generate My Trip"
          )}
        </Button>
      </form>
    </div>
  );
}
