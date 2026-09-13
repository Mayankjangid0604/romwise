"use client";

import { Suspense } from "react";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { createTrip, type TripState } from "@/app/actions/trips";
import {
  PageShell,
  PageHeader,
  Card,
  Alert,
  Field,
  Input,
  Select,
  Button,
} from "@/components/ui";

const initialState: TripState = {};

export default function NewTripPage() {
  return (
    <Suspense>
      <NewTripForm />
    </Suspense>
  );
}

function NewTripForm() {
  const searchParams = useSearchParams();
  const prefillDestination = searchParams.get("destination") ?? "";
  const [state, formAction, pending] = useActionState(createTrip, initialState);

  return (
    <PageShell width="form">
      <PageHeader backHref="/dashboard" backLabel="Dashboard" title="Create a Trip" />

      <Card>
        <form action={formAction} className="space-y-5">
          {state.error && <Alert tone="danger">{state.error}</Alert>}

          <Field
            label="Trip Title"
            htmlFor="title"
            error={state.fieldErrors?.title}
          >
            <Input
              id="title"
              name="title"
              type="text"
              required
              placeholder="e.g. Goa Beach Getaway"
              invalid={!!state.fieldErrors?.title}
            />
          </Field>

          <Field
            label="Destination"
            htmlFor="destination"
            error={state.fieldErrors?.destination}
          >
            <Input
              id="destination"
              name="destination"
              type="text"
              required
              defaultValue={prefillDestination}
              placeholder="e.g. Goa, India"
              invalid={!!state.fieldErrors?.destination}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Start Date"
              htmlFor="startDate"
              error={state.fieldErrors?.startDate}
            >
              <Input
                id="startDate"
                name="startDate"
                type="date"
                required
                invalid={!!state.fieldErrors?.startDate}
              />
            </Field>

            <Field
              label="End Date"
              htmlFor="endDate"
              error={state.fieldErrors?.endDate}
            >
              <Input
                id="endDate"
                name="endDate"
                type="date"
                required
                invalid={!!state.fieldErrors?.endDate}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Budget (₹ INR)"
              htmlFor="budget"
              error={state.fieldErrors?.budget}
            >
              <Input
                id="budget"
                name="budget"
                type="number"
                required
                min={1}
                placeholder="50000"
                invalid={!!state.fieldErrors?.budget}
              />
            </Field>

            <Field
              label="Max Travelers"
              htmlFor="maxTravelers"
              error={state.fieldErrors?.maxTravelers}
            >
              <Input
                id="maxTravelers"
                name="maxTravelers"
                type="number"
                min={1}
                max={20}
                defaultValue={4}
                invalid={!!state.fieldErrors?.maxTravelers}
              />
            </Field>
          </div>

          <Field
            label="Pace Level"
            htmlFor="paceLevel"
            error={state.fieldErrors?.paceLevel}
          >
            <Select
              id="paceLevel"
              name="paceLevel"
              defaultValue="balanced"
              invalid={!!state.fieldErrors?.paceLevel}
            >
              <option value="easy">Easy — relaxed schedule, fewer activities</option>
              <option value="balanced">
                Balanced — mix of activity and downtime
              </option>
              <option value="full">
                Full — packed schedule, maximum exploration
              </option>
            </Select>
          </Field>

          <Field
            label="Accessibility Needs (optional)"
            htmlFor="accessibilityNotes"
            hint="Comma-separated notes — used to add relevant items to your packing list"
          >
            <Input
              id="accessibilityNotes"
              name="accessibilityNotes"
              type="text"
              placeholder="e.g. wheelchair, hearing impaired, requires medication"
            />
          </Field>

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Creating..." : "Create Trip"}
          </Button>
        </form>
      </Card>
    </PageShell>
  );
}
