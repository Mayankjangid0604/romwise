"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { GeoCoordinates } from "@/lib/providers/maps";

// Fix missing marker icons in react-leaflet
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface MapProps {
  center: GeoCoordinates;
  zoom?: number;
  markers?: Array<GeoCoordinates & { label?: string; subtitle?: string }>;
  route?: Array<GeoCoordinates>;
  height?: string;
}

export default function Map({ center, zoom = 12, markers = [], route, height = "400px" }: MapProps) {
  useEffect(() => {
    // Leaflet bug workaround
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
  }, []);

  return (
    <div style={{ height, width: "100%" }} className="rounded-xl overflow-hidden border z-0 relative">
      <MapContainer 
        center={[center.lat, center.lng]} 
        zoom={zoom} 
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%", zIndex: 0 }}
      >
        <TileLayer
          attribution={
            process.env.NEXT_PUBLIC_MAPTILER_API_KEY
              ? '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>'
              : '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>'
          }
          url={
            process.env.NEXT_PUBLIC_MAPTILER_API_KEY
              ? `https://api.maptiler.com/maps/basic-v2/256/{z}/{x}/{y}.png?key=${process.env.NEXT_PUBLIC_MAPTILER_API_KEY}`
              : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          }
        />
        
        {markers.map((marker, i) => (
          <Marker key={i} position={[marker.lat, marker.lng]} icon={icon}>
            {(marker.label || marker.subtitle) && (
              <Popup>
                <div className="font-semibold">{marker.label}</div>
                {marker.subtitle && <div className="text-sm text-gray-600">{marker.subtitle}</div>}
              </Popup>
            )}
          </Marker>
        ))}

        {route && route.length > 1 && (
          <Polyline 
            positions={route.map(r => [r.lat, r.lng])}
            color="#0ea5e9" 
            weight={3}
            opacity={0.7}
            dashArray="10, 10"
          />
        )}
      </MapContainer>
    </div>
  );
}
