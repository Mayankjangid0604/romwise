"use client";

import { useState, useTransition } from "react";
import { updatePreference, deletePreference } from "@/app/actions/preferences";
import { CATEGORIES, PRIORITIES, type Category, type Priority } from "@/lib/preferences";
import { Select, Button, Alert } from "@/components/ui";

type PrefRecord = { id: string; category: string; priority: string; groupMemberId: string };

export function PreferenceClient({ 
  tripId, 
  initialPreferences 
}: { 
  tripId: string, 
  initialPreferences: PrefRecord[] 
}) {
  const [prefs, setPrefs] = useState<PrefRecord[]>(initialPreferences);
  const [pending, startTransition] = useTransition();

  const handleUpdate = (category: Category, priority: string) => {
    startTransition(async () => {
      if (!priority) {
        await deletePreference(tripId, category);
        setPrefs(prefs.filter(p => p.category !== category));
      } else {
        await updatePreference(tripId, category, priority as Priority);
        const existing = prefs.find(p => p.category === category);
        if (existing) {
          setPrefs(prefs.map(p => p.category === category ? { ...p, priority } : p));
        } else {
          setPrefs([...prefs, { id: Math.random().toString(), category, priority, groupMemberId: "" }]);
        }
      }
    });
  };

  return (
    <div className="space-y-4">
      {pending && <Alert tone="info">Saving preferences...</Alert>}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CATEGORIES.filter(cat => !cat.includes('heritage') && !cat.includes('spiritual')).map(cat => {
          const current = prefs.find(p => p.category === cat);
          return (
            <div key={cat} className="flex flex-col gap-1">
              <label className="text-sm font-medium text-ink-700 capitalize">
                {cat.replace("_", " ")}
              </label>
              <Select 
                value={current?.priority || ""}
                onChange={(e) => handleUpdate(cat, e.target.value)}
                disabled={pending}
              >
                <option value="">Neutral / No Preference</option>
                <option value="must-have">Must Have</option>
                <option value="very-important">Very Important</option>
                <option value="preferred">Preferred</option>
                <option value="nice-to-have">Nice to Have</option>
                <option value="avoid">Avoid</option>
                <option value="never">Never (Hard Exclusion)</option>
              </Select>
            </div>
          );
        })}
      </div>

      <div className="mt-8 border-t border-ink-200 pt-6">
        <h3 className="font-display text-lg font-semibold text-ink-800 mb-2">Spiritual & Cultural Heritage</h3>
        <p className="text-sm text-ink-500 mb-4">
          Roamwise does not assume any preferences based on your profile. If you have specific cultural or spiritual interests, please select them below.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {CATEGORIES.filter(cat => cat.includes('heritage') || cat.includes('spiritual')).map(cat => {
            const current = prefs.find(p => p.category === cat);
            const labelMap: Record<string, string> = {
              "spiritual_general": "General Spiritual Sites",
              "hindu_heritage": "Temples & Hindu Heritage",
              "islamic_heritage": "Mosques, Dargahs & Islamic Heritage",
              "sikh_heritage": "Gurdwaras & Sikh Heritage",
              "christian_heritage": "Churches & Christian Heritage",
              "buddhist_heritage": "Buddhist Monasteries & Heritage",
              "jain_heritage": "Jain Temples & Heritage",
              "other_sacred_heritage": "Other Sacred Heritage",
              "fewer_spiritual": "Prefer fewer religious sites",
            };
            return (
              <div key={cat} className="flex flex-col gap-1">
                <label className="text-sm font-medium text-ink-700">
                  {labelMap[cat] || cat.replace("_", " ")}
                </label>
                <Select 
                  value={current?.priority || ""}
                  onChange={(e) => handleUpdate(cat, e.target.value)}
                  disabled={pending}
                >
                  <option value="">No specific preference</option>
                  <option value="must-have">Must Have</option>
                  <option value="preferred">Preferred</option>
                  <option value="avoid">Avoid</option>
                </Select>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
