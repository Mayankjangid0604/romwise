import { mapProvider, GeoCoordinates } from "@/lib/providers/maps";

export function TransitLink({ from, to }: { from: GeoCoordinates; to: GeoCoordinates }) {
  const distance = mapProvider.calculateDistance(from, to);
  const timeMins = Math.round((distance / 30) * 60); // Assuming 30 km/h avg speed
  
  if (distance < 0.1) return null; // Very close

  return (
    <div className="flex items-center gap-4 py-2 px-4 -my-2 relative z-0">
      <div className="w-0.5 h-6 bg-ink-200 ml-4"></div>
      <div className="text-[0.625rem] font-medium text-ink-400 uppercase tracking-wide bg-white px-2 rounded-full border border-ink-100 shadow-sm flex items-center gap-1.5 -ml-7 relative">
        <span>🚗</span>
        {distance.toFixed(1)} km 
        <span className="text-ink-300">•</span> 
        ~{timeMins} min
      </div>
    </div>
  );
}
