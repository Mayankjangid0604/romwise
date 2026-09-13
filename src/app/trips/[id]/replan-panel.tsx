"use client";

import { useState, useTransition } from "react";
import { getReplanProposal, acceptReplan } from "@/app/actions/replan";
import type { ReplanProposal } from "@/lib/replanner";
import { Alert, Badge, Button, Field, Input } from "@/components/ui";

type Props = {
  tripId: string;
  dayNumber: number;
  itemId: string;
  itemTitle: string;
};

export function ReplanPanel({ tripId, dayNumber, itemId, itemTitle }: Props) {
  const [mode, setMode] = useState<"idle" | "form" | "proposal">("idle");
  const [disruptionType, setDisruptionType] = useState<"delayed" | "skipped">(
    "delayed",
  );
  const [delayMinutes, setDelayMinutes] = useState(30);
  const [proposal, setProposal] = useState<ReplanProposal | null>(null);
  const [pending, startTransition] = useTransition();
  const [accepted, setAccepted] = useState(false);

  function handlePropose() {
    startTransition(async () => {
      const result = await getReplanProposal(tripId, dayNumber, {
        disruptedItemId: itemId,
        type: disruptionType,
        delayMinutes: disruptionType === "delayed" ? delayMinutes : undefined,
      });
      setProposal(result);
      setMode("proposal");
    });
  }

  function handleAccept() {
    if (!proposal) return;
    startTransition(async () => {
      await acceptReplan(tripId, proposal);
      setAccepted(true);
    });
  }

  function handleReject() {
    setProposal(null);
    setMode("idle");
  }

  if (accepted) {
    return (
      <div className="mt-3">
        <Alert tone="success">
          Changes applied. Reload the page to see the updated itinerary.
        </Alert>
      </div>
    );
  }

  if (mode === "idle") {
    return (
      <button
        onClick={() => setMode("form")}
        className="mt-2 text-[0.75rem] font-medium text-ember-600 hover:text-ember-800 transition-colors"
      >
        Mark as delayed/skipped
      </button>
    );
  }

  if (mode === "form") {
    return (
      <div className="mt-3 rounded-card border border-ink-200 bg-ink-50 p-4 space-y-4">
        <p className="text-[0.875rem] font-medium text-ink-800">
          Report disruption: {itemTitle}
        </p>

        <div className="flex gap-5">
          <label className="flex items-center gap-2 text-[0.875rem] text-ink-700 cursor-pointer">
            <input
              type="radio"
              checked={disruptionType === "delayed"}
              onChange={() => setDisruptionType("delayed")}
              className="accent-ember-500"
            />
            Delayed
          </label>
          <label className="flex items-center gap-2 text-[0.875rem] text-ink-700 cursor-pointer">
            <input
              type="radio"
              checked={disruptionType === "skipped"}
              onChange={() => setDisruptionType("skipped")}
              className="accent-ember-500"
            />
            Skipped
          </label>
        </div>

        {disruptionType === "delayed" && (
          <Field label="Delay (minutes)">
            <Input
              type="number"
              min={5}
              max={180}
              value={delayMinutes}
              onChange={(e) => setDelayMinutes(parseInt(e.target.value) || 30)}
              className="w-28"
            />
          </Field>
        )}

        <div className="flex gap-2">
          <Button
            variant="disruption"
            size="sm"
            onClick={handlePropose}
            disabled={pending}
          >
            {pending ? "Calculating..." : "See Proposed Changes"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setMode("idle")}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "proposal" && proposal) {
    return (
      <div className="mt-3 rounded-card border border-ember-200 bg-ember-50 p-4 space-y-3">
        <div>
          <p className="text-[0.9375rem] font-medium text-ember-800">
            Proposed Replan
          </p>
          <p className="text-[0.8125rem] text-ember-800/80 mt-0.5">
            {proposal.conflictSummary}
          </p>
        </div>

        <div className="space-y-2">
          {proposal.changes
            .filter((c) => c.action !== "kept")
            .map((change) => {
              const isRemoval =
                change.action === "removed" || change.action === "skipped";
              return (
                <div
                  key={change.itemId}
                  className={`rounded-control border p-3 ${
                    isRemoval
                      ? "bg-danger-50 border-danger-200"
                      : "bg-lagoon-50 border-lagoon-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Badge tone={isRemoval ? "danger" : "lagoon"}>
                      {change.action}
                    </Badge>
                    <span className="text-[0.875rem] font-medium text-ink-800">
                      {change.title}
                    </span>
                  </div>
                  {change.action === "shifted" && (
                    <p className="font-mono tabular text-[0.75rem] text-ink-600 mt-1.5">
                      {change.previousStartTime}&ndash;{change.previousEndTime}{" "}
                      &rarr; {change.newStartTime}&ndash;{change.newEndTime}
                    </p>
                  )}
                  <p className="text-[0.75rem] text-ink-500 mt-1">
                    {change.reason}
                  </p>
                </div>
              );
            })}
        </div>

        {proposal.changes.every((c) => c.action === "kept") && (
          <p className="text-[0.875rem] text-success-700">
            No changes needed — schedule is fine.
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            variant="success"
            size="sm"
            onClick={handleAccept}
            disabled={pending}
          >
            {pending ? "Applying..." : "Accept Changes"}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleReject}>
            Reject
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
