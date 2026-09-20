"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "./cn";

interface FavoriteButtonProps {
  id: string;
  type: "place" | "destination";
  initialIsFavorite: boolean;
  className?: string;
}

export function FavoriteButton({ id, type, initialIsFavorite, className }: FavoriteButtonProps) {
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [loading, setLoading] = useState(false);

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (loading) return;
    
    const newStatus = !isFavorite;
    setIsFavorite(newStatus);
    setLoading(true);
    
    try {
      const endpoint = type === "place" ? "/api/favorites/places" : "/api/favorites/destinations";
      const body = type === "place" ? { placeId: id, isFavorite: newStatus } : { destinationId: id, isFavorite: newStatus };
      
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      
      if (!res.ok) {
        setIsFavorite(!newStatus); // revert on failure
      }
    } catch {
      setIsFavorite(!newStatus);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={toggleFavorite}
      disabled={loading}
      className={cn(
        "absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur shadow-sm flex items-center justify-center hover:scale-110 transition-transform z-10 disabled:opacity-50",
        className
      )}
      aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart className={cn("w-4 h-4", isFavorite ? "fill-danger-600 text-danger-600" : "text-ink-500")} />
    </button>
  );
}
