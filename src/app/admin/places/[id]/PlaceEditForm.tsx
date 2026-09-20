"use client";

import { Place } from "@prisma/client";
import { useState } from "react";
import { updatePlaceField } from "./actions";

export function PlaceEditForm({ place }: { place: Place }) {
  const [loading, setLoading] = useState<string | null>(null);
  
  const handleEdit = async (field: string, newValue: string | number | null) => {
    try {
      setLoading(field);
      await updatePlaceField(place.id, field, newValue);
    } catch (e) {
      alert("Failed to update field");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-ink-100">
      <h2 className="text-xl font-semibold mb-4">Edit Factual Data</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink-700">Cost (INR)</label>
          <input 
            type="number" 
            defaultValue={place.typicalCostInr || ""}
            onBlur={(e) => {
              const val = e.target.value ? parseInt(e.target.value) : null;
              if (val !== place.typicalCostInr) handleEdit("typicalCostInr", val);
            }}
            className="mt-1 block w-full rounded-md border-ink-300 shadow-sm sm:text-sm p-2 border"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-700">Duration (Minutes)</label>
          <input 
            type="number" 
            defaultValue={place.durationMinutes || ""}
            onBlur={(e) => {
              const val = e.target.value ? parseInt(e.target.value) : null;
              if (val !== place.durationMinutes) handleEdit("durationMinutes", val);
            }}
            className="mt-1 block w-full rounded-md border-ink-300 shadow-sm sm:text-sm p-2 border"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-700">Opening Time</label>
            <input 
              type="time" 
              defaultValue={place.openingTime || ""}
              onBlur={(e) => {
                const val = e.target.value || null;
                if (val !== place.openingTime) handleEdit("openingTime", val);
              }}
              className="mt-1 block w-full rounded-md border-ink-300 shadow-sm sm:text-sm p-2 border"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-700">Closing Time</label>
            <input 
              type="time" 
              defaultValue={place.closingTime || ""}
              onBlur={(e) => {
                const val = e.target.value || null;
                if (val !== place.closingTime) handleEdit("closingTime", val);
              }}
              className="mt-1 block w-full rounded-md border-ink-300 shadow-sm sm:text-sm p-2 border"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-700">Data Status</label>
          <select 
            defaultValue={place.dataStatus}
            onChange={(e) => handleEdit("dataStatus", e.target.value)}
            className="mt-1 block w-full rounded-md border-ink-300 shadow-sm sm:text-sm p-2 border"
          >
            <option value="seed">SEED</option>
            <option value="PENDING_REVIEW">PENDING_REVIEW</option>
            <option value="VERIFIED">VERIFIED</option>
            <option value="REJECTED">REJECTED</option>
          </select>
        </div>
        
        {loading && <p className="text-sm text-blue-600">Updating {loading}...</p>}
      </div>
    </div>
  );
}
