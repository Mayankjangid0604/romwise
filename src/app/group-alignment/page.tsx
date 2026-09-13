"use client";

import { useState } from "react";
import type { TravelerProfile, GroupAlignmentResponse } from "@/lib/group-alignment";
import {
  PageShell,
  PageHeader,
  Card,
  Alert,
  Field,
  Input,
  Select,
  Button,
  Badge,
  type BadgeTone,
} from "@/components/ui";

const EMPTY_TRAVELER: TravelerProfile = {
  name: "",
  pace: "balanced",
  interests: [],
  priorities: [],
  foodPreferences: [],
  accessibility: [],
};

function TravelerForm({
  traveler,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  traveler: TravelerProfile;
  index: number;
  onChange: (i: number, t: TravelerProfile) => void;
  onRemove: (i: number) => void;
  canRemove: boolean;
}) {
  function updateField(field: keyof TravelerProfile, value: string | string[]) {
    onChange(index, { ...traveler, [field]: value });
  }

  function handleCommaSeparated(field: keyof TravelerProfile, value: string) {
    updateField(
      field,
      value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg font-semibold text-ink-800">
          Traveler {index + 1}
        </h3>
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="text-[0.8125rem] font-medium text-danger-600 hover:text-danger-700 transition-colors"
          >
            Remove
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name">
            <Input
              type="text"
              value={traveler.name}
              onChange={(e) => updateField("name", e.target.value)}
              required
            />
          </Field>
          <Field label="Pace">
            <Select
              value={traveler.pace}
              onChange={(e) => updateField("pace", e.target.value)}
            >
              <option value="easy">Easy</option>
              <option value="balanced">Balanced</option>
              <option value="full">Full</option>
            </Select>
          </Field>
        </div>

        <Field label="Interests" hint="Comma-separated">
          <Input
            type="text"
            defaultValue={traveler.interests.join(", ")}
            onBlur={(e) => handleCommaSeparated("interests", e.target.value)}
            placeholder="e.g. hiking, photography, food"
          />
        </Field>

        <Field label="Priorities" hint="Comma-separated">
          <Input
            type="text"
            defaultValue={traveler.priorities.join(", ")}
            onBlur={(e) => handleCommaSeparated("priorities", e.target.value)}
            placeholder="e.g. relaxation, budget-friendly"
          />
        </Field>

        <Field label="Food preferences" hint="Comma-separated">
          <Input
            type="text"
            defaultValue={traveler.foodPreferences.join(", ")}
            onBlur={(e) =>
              handleCommaSeparated("foodPreferences", e.target.value)
            }
            placeholder="e.g. vegetarian, no seafood"
          />
        </Field>

        <Field label="Accessibility needs" hint="Comma-separated">
          <Input
            type="text"
            defaultValue={traveler.accessibility.join(", ")}
            onBlur={(e) => handleCommaSeparated("accessibility", e.target.value)}
            placeholder="e.g. wheelchair accessible, no long walks"
          />
        </Field>
      </div>
    </Card>
  );
}

export default function GroupAlignmentPage() {
  const [travelers, setTravelers] = useState<TravelerProfile[]>([
    { ...EMPTY_TRAVELER },
    { ...EMPTY_TRAVELER },
  ]);
  const [result, setResult] = useState<GroupAlignmentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function updateTraveler(index: number, traveler: TravelerProfile) {
    const updated = [...travelers];
    updated[index] = traveler;
    setTravelers(updated);
  }

  function removeTraveler(index: number) {
    setTravelers(travelers.filter((_, i) => i !== index));
  }

  function addTraveler() {
    if (travelers.length < 20) {
      setTravelers([...travelers, { ...EMPTY_TRAVELER }]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const res = await fetch("/api/group-alignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ travelers }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      setResult(data as GroupAlignmentResponse);
    } catch {
      setError("Failed to connect to the server");
    } finally {
      setLoading(false);
    }
  }

  const harmonyTone: BadgeTone = result
    ? result.harmonyScore >= 70
      ? "success"
      : result.harmonyScore >= 40
        ? "caution"
        : "danger"
    : "neutral";

  return (
    <PageShell>
      <PageHeader
        backHref="/dashboard"
        backLabel="Dashboard"
        title="Group Alignment"
        subtitle="Add traveler profiles to analyze group compatibility and get compromise suggestions. This does not change your trip itinerary."
      />

      <form onSubmit={handleSubmit} className="space-y-4 mb-8">
        {travelers.map((t, i) => (
          <TravelerForm
            key={i}
            traveler={t}
            index={i}
            onChange={updateTraveler}
            onRemove={removeTraveler}
            canRemove={travelers.length > 2}
          />
        ))}

        <div className="flex flex-wrap gap-3">
          {travelers.length < 20 && (
            <Button type="button" variant="secondary" onClick={addTraveler}>
              + Add Traveler
            </Button>
          )}

          <Button
            type="submit"
            disabled={loading || travelers.some((t) => !t.name.trim())}
          >
            {loading ? "Analyzing..." : "Analyze Alignment"}
          </Button>
        </div>
      </form>

      {error && (
        <Alert tone="danger" title="Analysis failed" className="mb-6">
          {error}
        </Alert>
      )}

      {result && (
        <Card>
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-xl font-semibold text-ink-900">
              Group Analysis
            </h2>
            <Badge tone={harmonyTone} className="shrink-0 px-3 py-1">
              Harmony{" "}
              <span className="font-mono tabular ml-1">
                {result.harmonyScore}/100
              </span>
            </Badge>
          </div>

          <div className="mt-5 pt-5 border-t border-ink-100 space-y-5">
            <div>
              <h3 className="text-[0.6875rem] font-medium uppercase tracking-wider text-ink-500 mb-1.5">
                Core Tension
              </h3>
              <p className="text-ink-700 leading-relaxed">{result.coreTension}</p>
            </div>

            <div>
              <h3 className="text-[0.6875rem] font-medium uppercase tracking-wider text-ink-500 mb-1.5">
                Suggested Compromise
              </h3>
              <p className="text-ink-700 leading-relaxed">
                {result.compromiseSuggestion}
              </p>
            </div>
          </div>
        </Card>
      )}
    </PageShell>
  );
}
