"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PlaceCard } from "@/components/ui";
import { PlaceDetailModal } from "@/components/ui/place-detail";
import { ReplanPanel } from "@/app/trips/[id]/replan-panel";
import { InlineEditPanel } from "@/app/trips/[id]/inline-edit-panel";

export type SortableItemType = {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  estimatedCostInr: number | null;
  costSource: string;
  category: string;
  reasoning: string;
  votes: { value: number }[];
  comments: unknown[];
  place?: { lat: number; lng: number; area: string | null } | null;
};

export function SortableItem({ id, item, tripId, dayNumber }: { id: string; item: SortableItemType; tripId: string; dayNumber: number }) {
  const [showDetail, setShowDetail] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing w-full">
      <PlaceCard
        title={item.title}
        category={item.category}
        description={item.description}
        address={item.place?.area}
        costEstimate={item.estimatedCostInr}
        duration={`${item.startTime} - ${item.endTime}`}
        className="w-full bg-white hover:bg-ink-50/50"
        onClick={() => setShowDetail(true)}
      >
        <div className="text-right shrink-0 absolute top-4 right-4 z-10 pointer-events-none">
          {item.estimatedCostInr !== null && (
            <span className={`block text-[0.625rem] mt-6 ${
              item.costSource === "db" || item.costSource === "free"
                ? "text-green-600"
                : item.costSource === "ai_estimated"
                ? "text-amber-500"
                : "text-ink-400"
            }`}>
              {item.costSource === "free" ? "Free"
                : item.costSource === "db" ? "Verified"
                : item.costSource === "ai_estimated" ? "Est."
                : ""}
            </span>
          )}
        </div>
        {item.reasoning && (
          <details className="mt-3 pt-3 border-t border-ink-100" onClick={(e) => e.stopPropagation()}>
            <summary className="text-[0.75rem] text-ink-400 cursor-pointer select-none hover:text-ink-600">
              Why this activity?
            </summary>
            <p className="text-[0.75rem] text-ink-400 italic mt-1">
              {item.reasoning}
            </p>
          </details>
        )}
        <div className="mt-4 pt-3 border-t border-ink-100 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-2">
            <button 
              className="text-xs font-medium text-ink-500 hover:text-green-600 bg-ink-50 px-2 py-1 rounded"
              onClick={() => fetch(`/api/trips/${tripId}/items/${item.id}/vote`, { method: "POST", body: JSON.stringify({ value: 1 })})}
            >
              👍 {item.votes?.filter((v: { value: number }) => v.value === 1).length || 0}
            </button>
            <button 
              className="text-xs font-medium text-ink-500 hover:text-red-600 bg-ink-50 px-2 py-1 rounded"
              onClick={() => fetch(`/api/trips/${tripId}/items/${item.id}/vote`, { method: "POST", body: JSON.stringify({ value: -1 })})}
            >
              👎 {item.votes?.filter((v: { value: number }) => v.value === -1).length || 0}
            </button>
          </div>
          <div className="text-xs text-ink-400">
            {item.comments?.length || 0} comments
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <ReplanPanel
            tripId={tripId}
            dayNumber={dayNumber}
            itemId={item.id}
            itemTitle={item.title}
          />
          <InlineEditPanel
            tripId={tripId}
            itemId={item.id}
            defaultTitle={item.title}
            defaultDescription={item.description}
            defaultStartTime={item.startTime}
            defaultEndTime={item.endTime}
            defaultCostInr={item.estimatedCostInr ?? null}
          />
        </div>
      </PlaceCard>
      
      {showDetail && (
        <PlaceDetailModal
          title={item.title}
          category={item.category}
          description={item.description}
          address={item.place?.area}
          costEstimate={item.estimatedCostInr}
          duration={`${item.startTime} - ${item.endTime}`}
          onClose={() => setShowDetail(false)}
        />
      )}
    </div>
  );
}
