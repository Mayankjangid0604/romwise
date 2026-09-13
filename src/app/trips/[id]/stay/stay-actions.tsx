"use client";

import { useTransition } from "react";
import { selectHotel, removeHotelSelection } from "@/app/actions/stay";
import { Button } from "@/components/ui";

export function HotelSelectButton({
  tripId,
  hotelName,
}: {
  tripId: string;
  hotelName: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      onClick={() =>
        startTransition(() => selectHotel(tripId, hotelName))
      }
      disabled={pending}
    >
      {pending ? "Selecting..." : "Select"}
    </Button>
  );
}

export function HotelRemoveButton({ tripId }: { tripId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => removeHotelSelection(tripId))}
      disabled={pending}
      className="text-[0.8125rem] font-medium text-danger-600 hover:text-danger-700 transition-colors disabled:opacity-50"
    >
      {pending ? "Removing..." : "Remove selection"}
    </button>
  );
}
