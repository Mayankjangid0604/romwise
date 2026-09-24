"use client";

import { useState } from "react";
import Image from "next/image";
import { Mountain, Map, Palmtree, Tent, Heart, Camera, Coffee, Backpack, Sun, TreePine, Castle, Landmark } from "lucide-react";

interface DiscoveryImageProps {
  src?: string | null;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  theme?: string;
}

export function DiscoveryImage({ src, alt, fill, width, height, className, theme }: DiscoveryImageProps) {
  const [error, setError] = useState(false);

  // If there's a valid src and no error yet, render the actual image
  if (src && !error) {
    return (
      <Image
        src={src}
        alt={alt}
        fill={fill}
        width={width}
        height={height}
        className={className}
        onError={() => setError(true)}
      />
    );
  }

  // Fallback rendering
  const getThemeIcon = () => {
    switch (theme) {
      case "mountains": return <Mountain className="w-12 h-12 text-white/50" />;
      case "beaches": return <Palmtree className="w-12 h-12 text-white/50" />;
      case "forests":
      case "nature":
      case "wildlife": return <TreePine className="w-12 h-12 text-white/50" />;
      case "heritage": return <Castle className="w-12 h-12 text-white/50" />;
      case "spiritual": return <Landmark className="w-12 h-12 text-white/50" />;
      case "adventure": return <Tent className="w-12 h-12 text-white/50" />;
      case "romantic": return <Heart className="w-12 h-12 text-white/50" />;
      case "photography": return <Camera className="w-12 h-12 text-white/50" />;
      case "food": return <Coffee className="w-12 h-12 text-white/50" />;
      case "backpacking": return <Backpack className="w-12 h-12 text-white/50" />;
      case "relaxing":
      case "weekend": return <Sun className="w-12 h-12 text-white/50" />;
      default: return <Map className="w-12 h-12 text-white/50" />;
    }
  };

  const getThemeGradient = () => {
    switch (theme) {
      case "mountains": return "from-slate-600 to-slate-800";
      case "beaches": return "from-cyan-600 to-blue-800";
      case "forests":
      case "nature":
      case "wildlife": return "from-emerald-600 to-green-900";
      case "heritage": return "from-amber-700 to-orange-900";
      case "spiritual": return "from-orange-500 to-red-800";
      case "adventure": return "from-stone-600 to-neutral-900";
      case "romantic": return "from-rose-500 to-pink-800";
      case "photography": return "from-indigo-600 to-purple-900";
      case "food": return "from-amber-600 to-yellow-900";
      default: return "from-slate-700 to-ink-900";
    }
  };

  return (
    <div className={`flex items-center justify-center bg-gradient-to-br ${getThemeGradient()} ${className} ${fill ? 'absolute inset-0' : ''}`} style={fill ? {} : { width, height }}>
      {getThemeIcon()}
      <span className="sr-only">{alt}</span>
    </div>
  );
}
