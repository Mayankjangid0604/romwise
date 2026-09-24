"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { DestinationDetails } from "@/lib/destination-brain";
import {
  PageShell,
  PageHeader,
  Card,
  Alert,
  Badge,
  SectionHeading,
  Button,
  Field,
  Input,
  Select,
} from "@/components/ui";

function DestinationDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const destinationName = decodeURIComponent(params.destination as string);
  const context = searchParams.get("context");

  const [details, setDetails] = useState<DestinationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [heroImage, setHeroImage] = useState<string | null>(null);

  // Quick-plan form state
  const [month, setMonth] = useState("");
  const [days, setDays] = useState("5");
  const [budget, setBudget] = useState("");
  const [pace, setPace] = useState("balanced");

  async function fetchDetails() {
    setLoading(true);
    setError(null);
    try {
      const contextParam = context ? `&context=${encodeURIComponent(context)}` : "";
      
      const [detailsRes, imageRes] = await Promise.all([
        fetch(`/api/destination-details?name=${encodeURIComponent(destinationName)}${contextParam}`),
        fetch(`/api/images/destination?name=${encodeURIComponent(destinationName)}`)
      ]);

      const data = await detailsRes.json();
      if (!detailsRes.ok) {
        setError(data.error || "Failed to load destination info");
        return;
      }
      setDetails(data as DestinationDetails);
      
      if (imageRes.ok) {
        const imageData = await imageRes.json();
        if (imageData.url) setHeroImage(imageData.url);
      }
    } catch {
      setError("Could not connect to the server");
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { fetchDetails(); }, [destinationName]);

  // Recalculate budget suggestion when days/details change — computed, not state
  const suggestedBudget = details
    ? String(details.averageDailyBudgetInr * (parseInt(days) || 5))
    : "";

  // budget is either user-edited or falls back to the suggestion
  const effectiveBudget = budget || suggestedBudget;

  function handlePlanTrip(e: React.FormEvent) {
    e.preventDefault();
    const monthIndex = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December"
    ].indexOf(month);
    const year = monthIndex !== -1 && monthIndex < new Date().getMonth() + 1
      ? new Date().getFullYear() + 1
      : new Date().getFullYear();
    const startDateStr = monthIndex !== -1
      ? `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`
      : new Date().toISOString().split("T")[0];
    const numDays = parseInt(days) || 5;
    const endDate = new Date(startDateStr);
    endDate.setDate(endDate.getDate() + numDays - 1);
    const endDateStr = endDate.toISOString().split("T")[0];

    const params = new URLSearchParams({
      destination: destinationName,
      startDate: startDateStr,
      endDate: endDateStr,
      budget: effectiveBudget || String((details?.averageDailyBudgetInr ?? 3000) * numDays),
      pace,
    });
    router.push(`/trips/new?${params.toString()}`);
  }

  if (loading) {
    return (
      <PageShell>
        <PageHeader backHref="/discovery" backLabel="Discovery" title={destinationName} />
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-4 border-lagoon-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-ink-500 text-sm">Building your destination guide…</p>
          </div>
        </div>
      </PageShell>
    );
  }

  if (error || !details) {
    return (
      <PageShell>
        <PageHeader backHref="/discovery" backLabel="Discovery" title={destinationName} />
        <Alert tone="danger" title="Couldn't load destination">
          {error ?? "Unknown error. Please try again."}
        </Alert>
        <Button variant="secondary" className="mt-4" onClick={fetchDetails}>
          Retry
        </Button>
      </PageShell>
    );
  }

  const MONTHS = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  return (
    <PageShell>
      {heroImage && (
        <div className="w-full h-64 md:h-80 relative rounded-xl overflow-hidden mb-6">
          <img src={heroImage} alt={details.name} className="object-cover w-full h-full" />
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <div className="text-center text-white">
              <h1 className="text-4xl md:text-5xl font-display font-bold mb-2">{details.name}</h1>
              <p className="text-lg md:text-xl font-medium text-white/90">{details.tagline}</p>
            </div>
          </div>
        </div>
      )}

      {!heroImage && (
        <PageHeader
          backHref="/discovery"
          backLabel="Discovery"
          title={details.name}
          subtitle={details.tagline}
        />
      )}

      {/* ── Overview & Vibe ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="md:col-span-2">
          <h2 className="font-display text-lg font-semibold text-ink-800 mb-2">Overview</h2>
          <p className="text-ink-700 leading-relaxed">{details.overview}</p>
          <div className="mt-4 p-3 rounded-control bg-lagoon-50 border border-lagoon-200">
            <p className="text-[0.75rem] font-medium uppercase tracking-wider text-lagoon-600 mb-1">
              The Vibe
            </p>
            <p className="text-ink-700 leading-relaxed italic">{details.vibe}</p>
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-lg font-semibold text-ink-800 mb-3">Quick Facts</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-[0.6875rem] font-medium uppercase tracking-wider text-ink-500">Best months</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {details.bestMonths.map((m) => (
                  <Badge key={m} tone="lagoon">{m}</Badge>
                ))}
              </dd>
            </div>
            <div>
              <dt className="text-[0.6875rem] font-medium uppercase tracking-wider text-ink-500">Suggested stay</dt>
              <dd className="mt-0.5 text-ink-700">
                {details.suggestedDays.min}–{details.suggestedDays.max} days
              </dd>
            </div>
            <div>
              <dt className="text-[0.6875rem] font-medium uppercase tracking-wider text-ink-500">Budget level</dt>
              <dd className="mt-0.5 text-ink-700">{details.budgetLevelLabel}</dd>
            </div>
            <div>
              <dt className="text-[0.6875rem] font-medium uppercase tracking-wider text-ink-500">Avg daily budget</dt>
              <dd className="mt-0.5 text-ink-700 font-medium">
                ₹{details.averageDailyBudgetInr.toLocaleString("en-IN")} / person
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      {/* ── Must Visit Places ── */}
      <SectionHeading>Must-Visit Places</SectionHeading>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {details.mustVisitPlaces.map((place, i) => (
          <Card key={i}>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-medium text-ink-900">{place.name}</h3>
                  <Badge tone="neutral" className="text-[0.6875rem]">{place.category}</Badge>
                </div>
                <p className="text-sm text-ink-600 leading-relaxed">{place.description}</p>
                <p className="text-[0.75rem] text-ink-500 mt-2">
                  <span className="font-medium">Best for:</span> {place.bestFor}
                </p>
                <div className="mt-2 p-2 rounded bg-amber-50 border border-amber-200">
                  <p className="text-[0.75rem] text-amber-800">
                    💡 {place.tipForVisiting}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Food & Tips ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <h2 className="font-display text-lg font-semibold text-ink-800 mb-3">Local Cuisine</h2>
          <ul className="space-y-2">
            {details.localCuisine.map((dish, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-ink-700">
                <span className="text-base">🍽️</span>
                {dish}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="font-display text-lg font-semibold text-ink-800 mb-3">Practical Tips</h2>
          <ul className="space-y-2">
            {details.practicalTips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink-700">
                <span className="text-base mt-0.5">✅</span>
                {tip}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* ── Quick Plan Form ── */}
      <SectionHeading>Plan Your Trip Here</SectionHeading>
      <Card className="mb-8">
        <p className="text-sm text-ink-500 mb-5">
          Fill in your preferences and we&apos;ll create a draft itinerary you can fully customise.
        </p>
        <form onSubmit={handlePlanTrip} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label="Month of travel" htmlFor="month">
            <Select
              id="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              required
            >
              <option value="" disabled>Pick a month…</option>
              {MONTHS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
          </Field>

          <Field label="Number of days" htmlFor="days">
            <Input
              id="days"
              type="number"
              min={1}
              max={30}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              required
            />
          </Field>

          <Field
            label="Budget (₹ INR total)"
            htmlFor="budget"
            hint={suggestedBudget ? `Suggested: ₹${parseInt(suggestedBudget).toLocaleString("en-IN")}` : undefined}
          >
            <Input
              id="budget"
              type="number"
              min={1}
              value={effectiveBudget}
              onChange={(e) => setBudget(e.target.value)}
              required
            />
          </Field>

          <Field label="Pace" htmlFor="pace">
            <Select id="pace" value={pace} onChange={(e) => setPace(e.target.value)}>
              <option value="easy">Easy — relaxed</option>
              <option value="balanced">Balanced</option>
              <option value="full">Full — packed</option>
            </Select>
          </Field>

          <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-4 pt-1">
            <Button type="submit">
              Create Draft Itinerary →
            </Button>
            <Link
              href={`/trips/new?destination=${encodeURIComponent(destinationName)}`}
              className="text-sm text-ink-500 hover:text-ink-700 transition-colors"
            >
              Or fill full form manually
            </Link>
          </div>
        </form>
      </Card>
    </PageShell>
  );
}

export default function DestinationDetailPage() {
  return (
    <Suspense fallback={
      <PageShell>
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-10 h-10 border-4 border-lagoon-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </PageShell>
    }>
      <DestinationDetailContent />
    </Suspense>
  );
}
