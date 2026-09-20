"use client";

import { useState, useTransition } from "react";
import { updateItineraryItem } from "@/app/actions/itinerary";
import { Alert, Button, Field, Input } from "@/components/ui";

type Props = {
  tripId: string;
  itemId: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultStartTime: string;
  defaultEndTime: string;
  defaultCostInr: number | null;
};

export function InlineEditPanel({
  tripId,
  itemId,
  defaultTitle,
  defaultDescription,
  defaultStartTime,
  defaultEndTime,
  defaultCostInr,
}: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription);
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [endTime, setEndTime] = useState(defaultEndTime);
  const [costInr, setCostInr] = useState(defaultCostInr !== null ? String(defaultCostInr) : "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateItineraryItem(tripId, itemId, {
        title,
        description,
        startTime,
        endTime,
        estimatedCostInr: costInr ? parseInt(costInr) : null,
      });
      if (result.success) {
        setSaved(true);
        setOpen(false);
      } else {
        setError(result.error);
      }
    });
  }

  if (saved) {
    return (
      <div className="mt-2">
        <Alert tone="success">
          Changes saved! Reload the page to see the updated values.
        </Alert>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 text-[0.75rem] font-medium text-lagoon-600 hover:text-lagoon-800 transition-colors"
      >
        ✏️ Edit this item
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-card border border-lagoon-200 bg-lagoon-50 p-4 space-y-3">
      <p className="text-[0.875rem] font-medium text-lagoon-800">Edit Item</p>

      {error && <Alert tone="danger">{error}</Alert>}

      <Field label="Title" htmlFor={`title-${itemId}`}>
        <Input
          id={`title-${itemId}`}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </Field>

      <Field label="Description" htmlFor={`desc-${itemId}`}>
        <Input
          id={`desc-${itemId}`}
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Start Time" htmlFor={`start-${itemId}`}>
          <Input
            id={`start-${itemId}`}
            type="text"
            placeholder="09:00"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </Field>
        <Field label="End Time" htmlFor={`end-${itemId}`}>
          <Input
            id={`end-${itemId}`}
            type="text"
            placeholder="10:30"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Cost (₹ INR)" htmlFor={`cost-${itemId}`}>
        <Input
          id={`cost-${itemId}`}
          type="number"
          min={0}
          placeholder="Leave blank if free"
          value={costInr}
          onChange={(e) => setCostInr(e.target.value)}
        />
      </Field>

      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={handleSave} disabled={pending}>
          {pending ? "Saving…" : "Save Changes"}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
