"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Route as RouteIcon } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableItem, SortableItemType } from "./sortable-item";
import { TransitLink } from "./transit-link";
import { Timeline, TimelineItem } from "@/components/ui/timeline";
import { AddPlacePanel } from "./add-place-panel";
import { formatDayLabel } from "@/lib/date-utils";

export function SortableDay({ day, tripId, isShortTrip }: { day: { id: string; dayNumber: number; date?: Date | string | null; items: SortableItemType[] }; tripId: string; isShortTrip?: boolean }) {
  const dayLabel = formatDayLabel(day.dayNumber, day.date);
  const router = useRouter();
  const [items, setItems] = useState(day.items);
  const [prevDayItems, setPrevDayItems] = useState(day.items);
  const isMounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  if (day.items !== prevDayItems) {
    setPrevDayItems(day.items);
    setItems(day.items);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }, // 5px movement required before drag starts
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  async function handleDragEnd(event: import("@dnd-kit/core").DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setItems((items: SortableItemType[]) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // Optimistic update
        // Call API to persist the order
        fetch(`/api/trips/${tripId}/reorder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dayId: day.id,
            items: newItems.map((item, idx: number) => ({ id: item.id, order: idx }))
          }),
        }).then(async res => {
          if (!res.ok) {
            const data = await res.json().catch(() => null);
            alert(data?.error || "Failed to reorder. The schedule might be impossible.");
            setItems(items); // revert
          } else {
            // Re-fetch server data to pick up the recomputed times (no full page reload)
            router.refresh();
          }
        }).catch(err => {
          console.error("Failed to reorder", err);
          alert("Network error while reordering.");
          setItems(items); // revert
        });

        return newItems;
      });
    }
  }

  if (!isMounted) {
    return (
      <div className="opacity-0">
        <Timeline>
          {items.map((item: SortableItemType) => (
            <TimelineItem key={item.id} title="">
              <div className="h-32 bg-ink-100 rounded-lg animate-pulse" />
            </TimelineItem>
          ))}
        </Timeline>
      </div>
    );
  }

  return (
    <DndContext
      id={`dnd-day-${day.id}`}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <DayHeader tripId={tripId} dayNumber={day.dayNumber} label={dayLabel} items={items} emphasizeTimes={isShortTrip} />
        <Timeline>
          {items.map((item: SortableItemType, index: number) => {
            const nextItem = items[index + 1];
            return (
              <TimelineItem 
                key={item.id}
                title=""
              >
                <SortableItem id={item.id} item={item} tripId={tripId} dayNumber={day.dayNumber} />
                {nextItem && item.place?.lat && nextItem.place?.lat && (
                  <TransitLink 
                    from={{ lat: item.place.lat, lng: item.place.lng }} 
                    to={{ lat: nextItem.place.lat, lng: nextItem.place.lng }} 
                  />
                )}
              </TimelineItem>
            );
          })}
        </Timeline>
        <AddPlacePanel
          tripId={tripId}
          days={[{ id: day.id, dayNumber: day.dayNumber, label: `Day ${day.dayNumber}` }]}
          initialDayId={day.id}
        />
      </SortableContext>
    </DndContext>
  );
}

function DayHeader({
  tripId,
  dayNumber,
  label,
  items,
  emphasizeTimes,
}: {
  tripId: string;
  dayNumber: number;
  label: string;
  items: SortableItemType[];
  emphasizeTimes?: boolean;
}) {
  const hasMappableStops = items.some((i) => i.place?.lat != null && i.place?.lng != null);
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-xl font-semibold text-ink-900">{label}</h2>
        {items.length > 0 && (
          <span
            className={
              emphasizeTimes
                ? "text-sm font-medium text-lagoon-700 bg-lagoon-50 border border-lagoon-100 px-3 py-1 rounded-md inline-flex items-center gap-2"
                : "text-[0.8125rem] text-ink-500 inline-flex items-center gap-1.5"
            }
          >
            <Clock className="w-4 h-4" />
            {items[0].startTime} — {items[items.length - 1].endTime}
            <span className="text-ink-300">·</span>
            {items.length} {items.length === 1 ? "stop" : "stops"}
          </span>
        )}
      </div>
      {hasMappableStops && (
        <Link
          href={`/trips/${tripId}/route?day=${dayNumber}`}
          className="text-[0.8125rem] font-medium text-lagoon-600 hover:text-lagoon-800 inline-flex items-center gap-1"
        >
          <RouteIcon className="w-4 h-4" /> View route
        </Link>
      )}
    </div>
  );
}

