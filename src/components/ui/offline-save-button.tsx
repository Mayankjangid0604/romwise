"use client";

import { useState, useEffect } from "react";
import { DownloadCloud, CheckCircle2 } from "lucide-react";
import { saveTripToOffline } from "@/lib/idb";
import { getOfflineTripData } from "@/app/actions/offline";
import { buttonStyles } from "@/components/ui/button";

// Takes only ids: the snapshot is fetched on click, so the overview page doesn't ship
// the whole trip (and its members' user records) to the browser on every view.
export function OfflineSaveButton({ tripId, userId }: { tripId: string, userId: string }) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // We could check if it's already saved, but for simplicity, we just allow re-saving
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const trip = await getOfflineTripData(tripId);
      if (!trip) throw new Error("Trip not available for offline save");
      localStorage.setItem('roamwise_user_id', userId);
      await saveTripToOffline(trip, userId);
      setSaved(true);
    } catch (e) {
      console.error("Failed to save offline", e);
    }
    setSaving(false);
  };

  if (saved) {
    return (
      <button 
        disabled
        className={buttonStyles({ variant: "secondary", size: "sm", className: "bg-green-500/10 text-green-700 border-green-500/20 backdrop-blur-md gap-2 opacity-100" })}
      >
        <CheckCircle2 className="w-4 h-4" /> Saved for Offline
      </button>
    );
  }

  return (
    <button 
      onClick={handleSave}
      disabled={saving}
      className={buttonStyles({ variant: "secondary", size: "sm", className: "bg-white/10 text-white border-white/20 hover:bg-white/20 backdrop-blur-md gap-2" })}
    >
      <DownloadCloud className="w-4 h-4" /> {saving ? "Saving..." : "Save for Offline"}
    </button>
  );
}
