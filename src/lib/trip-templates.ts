export interface TripTemplate {
  id: string;
  title: string;
  description: string;
  durationDays: number;
  paceLevel: "easy" | "balanced" | "full";
  budgetInr: number;
  maxTravelers: number;
  tripType: "MULTI_DAY" | "WEEKEND" | "DAY_TRIP";
  packingList: { name: string; category: string; quantity: number }[];
  preferences: { category: string; priority: "high" | "medium" | "low" }[];
}

export const TRIP_TEMPLATES: TripTemplate[] = [
  {
    id: "weekend-getaway",
    title: "Weekend",
    description: "A quick, action-packed 2-day escape to recharge.",
    durationDays: 2,
    paceLevel: "full",
    budgetInr: 15000,
    maxTravelers: 4,
    tripType: "WEEKEND",
    packingList: [
      { name: "Daypack", category: "Bags", quantity: 1 },
      { name: "Comfortable Shoes", category: "Clothing", quantity: 1 },
      { name: "Water Bottle", category: "Essentials", quantity: 1 },
      { name: "Power Bank", category: "Electronics", quantity: 1 },
    ],
    preferences: [
      { category: "Attractions", priority: "high" },
      { category: "Food", priority: "medium" },
    ],
  },
  {
    id: "honeymoon",
    title: "Honeymoon",
    description: "A relaxed, luxurious 7-day trip for two.",
    durationDays: 7,
    paceLevel: "easy",
    budgetInr: 100000,
    maxTravelers: 2,
    tripType: "MULTI_DAY",
    packingList: [
      { name: "Evening Wear", category: "Clothing", quantity: 2 },
      { name: "Camera", category: "Electronics", quantity: 1 },
      { name: "Sunscreen", category: "Toiletries", quantity: 1 },
      { name: "Swimwear", category: "Clothing", quantity: 2 },
    ],
    preferences: [
      { category: "Relaxation", priority: "high" },
      { category: "Food", priority: "high" },
      { category: "Luxury", priority: "high" },
    ],
  },
  {
    id: "family-vacation",
    title: "Family",
    description: "A balanced 5-day trip with kid-friendly activities.",
    durationDays: 5,
    paceLevel: "balanced",
    budgetInr: 60000,
    maxTravelers: 6,
    tripType: "MULTI_DAY",
    packingList: [
      { name: "First Aid Kit", category: "Health", quantity: 1 },
      { name: "Snacks", category: "Food", quantity: 5 },
      { name: "Entertainment (Tablet/Games)", category: "Electronics", quantity: 1 },
      { name: "Extra Clothes", category: "Clothing", quantity: 4 },
    ],
    preferences: [
      { category: "Family-Friendly", priority: "high" },
      { category: "Safety", priority: "high" },
    ],
  },
  {
    id: "solo-adventure",
    title: "Solo",
    description: "A flexible 3-day journey focused on personal exploration.",
    durationDays: 3,
    paceLevel: "balanced",
    budgetInr: 20000,
    maxTravelers: 1,
    tripType: "MULTI_DAY",
    packingList: [
      { name: "Journal/Book", category: "Entertainment", quantity: 1 },
      { name: "Portable Charger", category: "Electronics", quantity: 1 },
      { name: "Headphones", category: "Electronics", quantity: 1 },
    ],
    preferences: [
      { category: "Culture", priority: "high" },
      { category: "Nature", priority: "medium" },
    ],
  },
  {
    id: "backpacking",
    title: "Backpacking",
    description: "A fast-paced, budget-friendly 10-day expedition.",
    durationDays: 10,
    paceLevel: "full",
    budgetInr: 30000,
    maxTravelers: 4,
    tripType: "MULTI_DAY",
    packingList: [
      { name: "Hiking Backpack 50L", category: "Bags", quantity: 1 },
      { name: "Tent/Sleeping Bag", category: "Camping", quantity: 1 },
      { name: "Trekking Poles", category: "Gear", quantity: 1 },
      { name: "Water Filter", category: "Essentials", quantity: 1 },
    ],
    preferences: [
      { category: "Adventure", priority: "high" },
      { category: "Budget", priority: "high" },
      { category: "Nature", priority: "high" },
    ],
  },
];
