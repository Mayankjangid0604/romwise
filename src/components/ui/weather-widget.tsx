"use client";

import { useEffect, useState } from "react";
import { WeatherForecast } from "@/lib/providers/weather";
import { Card } from "@/components/ui";

interface WeatherWidgetProps {
  lat: number;
  lng: number;
  startDate: string;
  endDate: string;
}

export function WeatherWidget({ lat, lng, startDate, endDate }: WeatherWidgetProps) {
  const [forecast, setForecast] = useState<WeatherForecast[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWeather() {
      try {
        const res = await fetch(`/api/weather?lat=${lat}&lng=${lng}&start=${startDate}&end=${endDate}`);
        const data = await res.json();
        if (res.ok) setForecast(data);
      } catch (err) {
        console.error("Failed to load weather", err);
      } finally {
        setLoading(false);
      }
    }
    fetchWeather();
  }, [lat, lng, startDate, endDate]);

  if (loading) {
    return <div className="animate-pulse h-20 bg-muted/20 rounded-xl" />;
  }

  if (forecast.length === 0) return null;

  return (
    <Card className="mb-8 p-4">
      <h3 className="text-sm font-medium text-ink-500 uppercase tracking-wider mb-3">Weather Forecast</h3>
      <div className="flex overflow-x-auto gap-4 pb-2 snap-x">
        {forecast.map((day, i) => (
          <div key={i} className="flex-none w-24 flex flex-col items-center justify-center p-2 rounded-lg bg-muted/30 snap-start">
            <span className="text-xs font-medium text-ink-600">
              {new Date(day.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            </span>
            <span className="text-2xl my-1">{day.icon}</span>
            <div className="text-xs font-medium space-x-1">
              <span className="text-ink-900">{day.maxTempC}°</span>
              <span className="text-ink-400">{day.minTempC}°</span>
            </div>
            <span className="text-[10px] text-ink-500 text-center mt-1">{day.condition}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
