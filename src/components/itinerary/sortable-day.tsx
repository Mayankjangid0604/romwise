"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
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

export function SortableDay({ day, tripId, isShortTrip }: { day: { id: string; dayNumber: number; items: SortableItemType[] }; tripId: string; isShortTrip?: boolean }) {
  const [items, setItems] = useState(day.items);
  const [prevDayItems, setPrevDayItems] = useState(day.items);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
            // Force a hard refresh to get the recomputed times
            window.location.reload();
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
        {isShortTrip && items.length > 0 && (
          <div className="mb-4 text-sm font-medium text-lagoon-700 bg-lagoon-50 border border-lagoon-100 px-3 py-1.5 rounded-md inline-flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {items[0].startTime} — {items[items.length - 1].endTime}
          </div>
        )}
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
        <div className="mt-4 flex justify-center">
          <button
            onClick={async () => {
              const { addItineraryItem } = await import("@/app/actions/itinerary");
              await addItineraryItem(tripId, day.id);
            }}
            className="text-[0.875rem] font-medium text-lagoon-600 hover:text-lagoon-800 flex items-center gap-1 transition-colors"
          >
            <span className="text-lg">+</span> Add Activity
          </button>
        </div>
      </SortableContext>
    </DndContext>
  );
}
