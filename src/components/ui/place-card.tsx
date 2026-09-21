"use client";

import { Card } from "./card";
import { Badge } from "./badge";
import { Clock, IndianRupee, MapPin, Heart } from "lucide-react";
import { useState } from "react";
import { FavoriteButton } from "./favorite-button";
import { cn } from "./cn";
import { Activity, Accessibility } from "lucide-react";

export interface PlaceCardProps {
  placeId?: string;
  title: string;
  category?: string;
  imageUrl?: string | null;
  duration?: string | null;
  costEstimate?: number | null;
  description?: string | null;
  address?: string | null;
  accessibilityScore?: number | null;
  fatigueCost?: number | null;
  isFavorite?: boolean;
  onFavoriteToggle?: () => void;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function PlaceCard({
  placeId,
  title,
  category,
  imageUrl,
  duration,
  costEstimate,
  description,
  address,
  accessibilityScore,
  fatigueCost,
  isFavorite = false,
  onFavoriteToggle,
  onClick,
  className,
  children,
}: PlaceCardProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <Card 
      className={cn(
        "overflow-hidden flex flex-col sm:flex-row group transition-all hover:shadow-card cursor-pointer border-ink-100", 
        className
      )}
      onClick={onClick}
    >
      <div className="relative w-full sm:w-48 h-40 sm:h-auto shrink-0 bg-ink-100 overflow-hidden">
        {imageUrl && !imgError ? (
          <img 
            src={imageUrl} 
            alt={title} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-ink-500 bg-gradient-to-br from-lagoon-50 to-ink-100 p-4 text-center">
            <MapPin className="w-8 h-8 mb-2 opacity-50 text-lagoon-600" />
            <span className="text-[10px] uppercase tracking-wider font-bold opacity-70 mb-1">{category || "Place"}</span>
            <span className="text-sm font-medium line-clamp-2" aria-label={`Illustration of ${title}`}>{title}</span>
          </div>
        )}
        
        {placeId && (
          <FavoriteButton 
            id={placeId} 
            type="place" 
            initialIsFavorite={isFavorite} 
          />
        )}
        
        {!placeId && onFavoriteToggle && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onFavoriteToggle();
            }}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur shadow-sm flex items-center justify-center hover:scale-110 transition-transform z-10"
          >
            <Heart className={cn("w-4 h-4", isFavorite ? "fill-danger-600 text-danger-600" : "text-ink-500")} />
          </button>
        )}
      </div>

      <div className="p-4 sm:p-5 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-1">
          <h4 className="font-semibold text-lg text-ink-900 line-clamp-1">{title}</h4>
          {category && (
            <Badge tone="neutral" className="shrink-0 ml-2 capitalize text-xs">
              {category.toLowerCase()}
            </Badge>
          )}
        </div>

        {address && (
          <p className="text-xs text-ink-400 flex items-center gap-1 mb-3 line-clamp-1">
            <MapPin className="w-3 h-3 shrink-0" /> {address}
          </p>
        )}

        {description && (
          <p className="text-sm text-ink-600 line-clamp-2 mb-4 flex-1">
            {description}
          </p>
        )}

        <div className="flex items-center gap-4 mt-auto pt-4 border-t border-ink-100">
          {duration && (
            <div className="flex items-center gap-1.5 text-sm text-ink-500 font-medium">
              <Clock className="w-4 h-4 text-ink-400" />
              <span>{duration}</span>
            </div>
          )}
          {costEstimate != null && (
            <div className="flex items-center gap-1 text-sm text-ink-500 font-medium">
              <IndianRupee className="w-4 h-4 text-ink-400" />
              <span>{costEstimate === 0 ? "Free" : costEstimate.toLocaleString()}</span>
            </div>
          )}
          
          {(accessibilityScore != null || fatigueCost != null) && (
            <div className="flex items-center gap-3 ml-auto text-sm text-ink-500">
              {accessibilityScore != null && (
                <div 
                  className={cn(
                    "flex items-center gap-1",
                    accessibilityScore >= 8 ? "text-success-600" : 
                    accessibilityScore >= 5 ? "text-warning-600" : "text-danger-600"
                  )}
                  title={`Accessibility Score: ${accessibilityScore}/10`}
                >
                  <Accessibility className="w-4 h-4" />
                  <span className="font-medium">{accessibilityScore}/10</span>
                </div>
              )}
              {fatigueCost != null && (
                <div 
                  className={cn(
                    "flex items-center gap-1",
                    fatigueCost <= 3 ? "text-success-600" : 
                    fatigueCost <= 6 ? "text-warning-600" : "text-danger-600"
                  )}
                  title={`Fatigue Cost: ${fatigueCost}/10`}
                >
                  <Activity className="w-4 h-4" />
                  <span className="font-medium">{fatigueCost}/10</span>
                </div>
              )}
            </div>
          )}
        </div>
        {children}
      </div>
    </Card>
  );
}
