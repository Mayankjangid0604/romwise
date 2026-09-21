import { z } from "zod";
import { type WeatherForecast } from "./providers/weather";

export type PackingCategory =

  | "clothing"
  | "toiletries"
  | "electronics"
  | "documents"
  | "health"
  | "accessories"
  | "misc";

export type GeneratedPackingItem = {
  label: string;
  category: PackingCategory;
  essential: boolean;
};

export type PackingInput = {
  durationDays: number;
  accessibilityNotes: string[];
  destinationName?: string;
  weather?: WeatherForecast[];
};

const BASE_ITEMS: GeneratedPackingItem[] = [
  { label: "Passport / ID", category: "documents", essential: true },
  { label: "Travel tickets", category: "documents", essential: true },
  { label: "Hotel booking confirmation", category: "documents", essential: true },
  { label: "Travel insurance documents", category: "documents", essential: false },
  { label: "Cash and cards", category: "documents", essential: true },

  { label: "Phone charger", category: "electronics", essential: true },
  { label: "Power bank", category: "electronics", essential: false },
  { label: "Camera", category: "electronics", essential: false },
  { label: "Earphones / headphones", category: "electronics", essential: false },

  { label: "Toothbrush and toothpaste", category: "toiletries", essential: true },
  { label: "Shampoo and soap", category: "toiletries", essential: true },
  { label: "Deodorant", category: "toiletries", essential: false },
  { label: "Sunscreen", category: "toiletries", essential: false },

  { label: "Underwear", category: "clothing", essential: true },
  { label: "Socks", category: "clothing", essential: true },
  { label: "T-shirts / tops", category: "clothing", essential: true },
  { label: "Pants / shorts", category: "clothing", essential: true },
  { label: "Sleepwear", category: "clothing", essential: false },
  { label: "Comfortable walking shoes", category: "clothing", essential: true },

  { label: "Prescription medications", category: "health", essential: true },
  { label: "First aid kit", category: "health", essential: false },
  { label: "Hand sanitizer", category: "health", essential: false },

  { label: "Sunglasses", category: "accessories", essential: false },
  { label: "Water bottle", category: "accessories", essential: false },
  { label: "Day backpack", category: "accessories", essential: false },

  { label: "Snacks for travel", category: "misc", essential: false },
  { label: "Plastic bags for laundry", category: "misc", essential: false },
];

const LONG_TRIP_ITEMS: GeneratedPackingItem[] = [
  { label: "Laundry detergent sachets", category: "misc", essential: false },
  { label: "Extra set of clothes", category: "clothing", essential: false },
  { label: "Travel pillow", category: "accessories", essential: false },
  { label: "Umbrella / rain jacket", category: "clothing", essential: false },
  { label: "Adapter / voltage converter", category: "electronics", essential: false },
];

const ACCESSIBILITY_ITEMS: Record<string, GeneratedPackingItem[]> = {
  wheelchair: [
    { label: "Wheelchair rain cover", category: "accessories", essential: true },
    { label: "Portable ramp", category: "accessories", essential: false },
    { label: "Wheelchair repair kit", category: "misc", essential: false },
  ],
  mobility: [
    { label: "Walking stick / cane", category: "accessories", essential: true },
    { label: "Knee brace / support", category: "health", essential: false },
    { label: "Compression socks", category: "health", essential: false },
  ],
  hearing: [
    { label: "Hearing aid batteries", category: "health", essential: true },
    { label: "Written communication cards", category: "accessories", essential: false },
  ],
  vision: [
    { label: "Spare glasses / contacts", category: "health", essential: true },
    { label: "Magnifying glass", category: "accessories", essential: false },
  ],
  medication: [
    { label: "Medication schedule printout", category: "health", essential: true },
    { label: "Pill organizer", category: "health", essential: true },
    { label: "Doctor's prescription copy", category: "documents", essential: true },
  ],
};

export function generatePackingList(input: PackingInput): GeneratedPackingItem[] {
  const items = [...BASE_ITEMS];

  if (input.durationDays >= 5) {
    items.push(...LONG_TRIP_ITEMS);
  }

  const normalizedNotes = input.accessibilityNotes.map((n) =>
    n.toLowerCase().trim(),
  );

  for (const [keyword, accessItems] of Object.entries(ACCESSIBILITY_ITEMS)) {
    if (normalizedNotes.some((note) => note.includes(keyword))) {
      for (const item of accessItems) {
        if (!items.some((existing) => existing.label === item.label)) {
          items.push(item);
        }
      }
    }
  }

  return items;
}

const WEATHER_ITEMS: Record<string, GeneratedPackingItem[]> = {
  rain: [
    { label: "Umbrella", category: "accessories", essential: true },
    { label: "Rain jacket", category: "clothing", essential: true },
    { label: "Waterproof shoes", category: "clothing", essential: false },
  ],
  cold: [
    { label: "Winter coat", category: "clothing", essential: true },
    { label: "Thermal underwear", category: "clothing", essential: true },
    { label: "Gloves", category: "accessories", essential: true },
    { label: "Scarf", category: "accessories", essential: false },
    { label: "Beanie / warm hat", category: "accessories", essential: true },
  ],
  hot: [
    { label: "Sun hat", category: "accessories", essential: true },
    { label: "Light breathable clothing", category: "clothing", essential: true },
    { label: "Swimwear", category: "clothing", essential: false },
    { label: "Aloe vera / aftersun", category: "health", essential: false },
  ]
};

export async function generateIntelligentPackingList(input: PackingInput): Promise<GeneratedPackingItem[]> {
  // Base deterministic items are always a good foundation
  const baseItems = generatePackingList(input);
  
  if (!input.destinationName || !input.weather || input.weather.length === 0) {
    return baseItems; // fallback to deterministic
  }

  const combined = [...baseItems];
  const existingLabels = new Set(combined.map(i => i.label.toLowerCase()));

  const addItems = (newItems: GeneratedPackingItem[]) => {
    for (const item of newItems) {
      if (!existingLabels.has(item.label.toLowerCase())) {
        combined.push(item);
        existingLabels.add(item.label.toLowerCase());
      }
    }
  };

  let hasRain = false;
  let minTemp = 100;
  let maxTemp = -100;

  for (const w of input.weather) {
    if (w.condition.toLowerCase().includes("rain") || w.condition.toLowerCase().includes("storm") || w.condition.toLowerCase().includes("shower")) {
      hasRain = true;
    }
    if (w.minTempC < minTemp) minTemp = w.minTempC;
    if (w.maxTempC > maxTemp) maxTemp = w.maxTempC;
  }

  if (hasRain) {
    addItems(WEATHER_ITEMS.rain);
  }
  if (minTemp < 10) {
    addItems(WEATHER_ITEMS.cold);
  }
  if (maxTemp > 25) {
    addItems(WEATHER_ITEMS.hot);
  }

  return combined;
}
