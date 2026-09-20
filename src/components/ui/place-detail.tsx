"use client";

import { X, MapPin, Clock, IndianRupee, Accessibility, Sun, Moon } from "lucide-react";
import { Badge } from "./badge";
import { useEffect, useState } from "react";

export interface PlaceDetailProps {
  title: string;
  category?: string;
  imageUrl?: string | null;
  duration?: string | null;
  costEstimate?: number | null;
  description?: string | null;
  address?: string | null;
  season?: string | null;
  timeOfDay?: string | null;
  accessibility?: string | null;
  onClose: () => void;
}

export function PlaceDetailModal({
  title,
  category,
  imageUrl,
  duration,
  costEstimate,
  description,
  address,
  season,
  timeOfDay,
  accessibility,
  onClose,
}: PlaceDetailProps) {
  const [imgError, setImgError] = useState(false);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-64 w-full bg-ink-100">
          {imageUrl && !imgError ? (
            <img 
              src={imageUrl} 
              alt={title} 
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-ink-500 bg-gradient-to-br from-lagoon-100 to-ink-100 p-6 text-center">
              <MapPin className="w-12 h-12 mb-3 opacity-50 text-lagoon-600" />
              <span className="text-sm uppercase tracking-wider font-bold opacity-70 mb-2">{category || "Place"}</span>
              <span className="text-2xl font-medium" aria-label={`Illustration of ${title}`}>{title}</span>
            </div>
          )}
          
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors backdrop-blur"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 md:p-8">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold text-ink-900">{title}</h2>
              {address && (
                <p className="text-sm text-ink-500 mt-2 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 shrink-0" /> {address}
                </p>
              )}
            </div>
            {category && (
              <Badge tone="neutral" className="capitalize px-3 py-1 text-sm">
                {category.toLowerCase()}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-4 py-5 border-y border-ink-100 my-6">
            {duration && (
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-lagoon-500" />
                <span className="text-sm font-medium text-ink-700">{duration}</span>
              </div>
            )}
            {costEstimate != null && (
              <div className="flex items-center gap-2">
                <IndianRupee className="w-5 h-5 text-ember-500" />
                <span className="text-sm font-medium text-ink-700">{costEstimate === 0 ? "Free" : costEstimate.toLocaleString()}</span>
              </div>
            )}
            {timeOfDay && (
              <div className="flex items-center gap-2">
                {timeOfDay.toLowerCase().includes('night') ? <Moon className="w-5 h-5 text-purple-500" /> : <Sun className="w-5 h-5 text-amber-500" />}
                <span className="text-sm font-medium text-ink-700 capitalize">{timeOfDay.toLowerCase()}</span>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-ink-900 uppercase tracking-wider mb-2">About</h3>
              <p className="text-ink-600 leading-relaxed">
                {description || "No description available for this place."}
              </p>
            </div>

            {(season || accessibility) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-ink-50 p-5 rounded-xl">
                {season && (
                  <div>
                    <h4 className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-1">Best Season</h4>
                    <p className="text-sm text-ink-800 font-medium capitalize">{season}</p>
                  </div>
                )}
                {accessibility && (
                  <div>
                    <h4 className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Accessibility className="w-3 h-3" /> Accessibility
                    </h4>
                    <p className="text-sm text-ink-800 font-medium capitalize">{accessibility}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
