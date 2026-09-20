"use client";

import { useState } from "react";
import Link from "next/link";
import type { DiscoveryResponse } from "@/lib/discovery";
import {
  PageShell,
  PageHeader,
  Card,
  Alert,
  Field,
  Textarea,
  Button,
  Badge,
  SectionHeading,
} from "@/components/ui";

export default function DiscoveryPage() {
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<DiscoveryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const res = await fetch("/api/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      setResult(data as DiscoveryResponse);
    } catch {
      setError("Failed to connect to the server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        backHref="/dashboard"
        backLabel="Dashboard"
        title="Discover Destinations"
        subtitle="Describe the trip you have in mind and get three tailored suggestions."
      />

      <Card className="mb-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            label="Describe your ideal trip"
            htmlFor="description"
            hint={`${description.length}/1000 characters`}
          >
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              maxLength={1000}
              rows={4}
              placeholder="e.g. A calm seven-day food and art trip in November for four adults, moderate budget, prefer warm weather"
            />
          </Field>

          <Button
            type="submit"
            disabled={loading || description.trim().length === 0}
          >
            {loading ? "Discovering..." : "Discover Destinations"}
          </Button>
        </form>
      </Card>

      {error && (
        <Alert tone="danger" title="Discovery failed" className="mb-8">
          {error}
        </Alert>
      )}

      {result && (
        <div>
          <SectionHeading>Suggested Destinations</SectionHeading>

          <div className="space-y-4">
            {result.destinations.map((dest, i) => (
              <Card key={i}>
                <div className="flex items-start justify-between gap-4">
                  <Link
                    href={`/discovery/${encodeURIComponent(dest.name)}?context=${encodeURIComponent(dest.rationale)}`}
                    className="font-display text-xl font-semibold text-ink-900 hover:text-lagoon-700 transition-colors"
                  >
                    {dest.name}
                  </Link>
                  <Badge tone="lagoon" className="shrink-0 px-3 py-1">
                    <span className="font-mono tabular">{dest.matchScore}%</span>
                    <span className="ml-1">match</span>
                  </Badge>
                </div>

                <p className="text-ink-700 mt-3 leading-relaxed">
                  {dest.rationale}
                </p>

                <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 pt-4 border-t border-ink-100">
                  <div>
                    <dt className="text-[0.6875rem] font-medium uppercase tracking-wider text-ink-500">
                      Climate
                    </dt>
                    <dd className="text-[0.875rem] text-ink-700 mt-0.5">
                      {dest.climate}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.6875rem] font-medium uppercase tracking-wider text-ink-500">
                      Best time
                    </dt>
                    <dd className="text-[0.875rem] text-ink-700 mt-0.5">
                      {dest.bestTravelTime}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.6875rem] font-medium uppercase tracking-wider text-ink-500">
                      Budget level
                    </dt>
                    <dd className="text-[0.875rem] text-ink-700 mt-0.5 capitalize">
                      {dest.suggestedBudgetLevel}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4">
                  <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-ink-500 mb-2">
                    Activities
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {dest.activities.map((activity, j) => (
                      <Badge key={j} tone="neutral">
                        {activity}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-ink-100 flex items-center gap-4">
                  <Link
                    href={`/discovery/${encodeURIComponent(dest.name)}?context=${encodeURIComponent(dest.rationale)}`}
                    className="inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-lagoon-700 hover:text-lagoon-800 transition-colors"
                  >
                    Explore destination →
                  </Link>
                  <Link
                    href={`/trips/new?destination=${encodeURIComponent(dest.name)}`}
                    className="inline-flex items-center gap-1.5 text-[0.875rem] text-ink-500 hover:text-ink-700 transition-colors"
                  >
                    Skip to trip form
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </PageShell>
  );
}
