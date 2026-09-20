import { z } from "zod";

export const TripInputSchema = z.object({
  title: z.string().min(1, "Trip title is required"),
  destination: z.string().min(1, "Destination is required"),
  startDate: z.string(),
  endDate: z.string(),
  budget: z.coerce.number().positive("Budget must be a positive number"),
  maxTravelers: z.coerce.number().min(1, "Travelers must be between 1 and 20").max(20).default(20),
  paceLevel: z.enum(["easy", "balanced", "full"]).optional(),
  tripType: z.enum(["ONE_DAY", "MULTI_DAY", "FLEXIBLE"]).optional().default("MULTI_DAY"),
}).refine(data => {
  if (data.tripType === "FLEXIBLE") return true;
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  if (data.tripType === "ONE_DAY") {
    return end.getTime() >= start.getTime(); // ONE_DAY allows start == end
  }
  return end.getTime() > start.getTime(); // MULTI_DAY requires end > start
}, { message: "End date must be after start date for multi-day trips", path: ["endDate"] })
.refine(data => {
  if (data.tripType === "FLEXIBLE") return true;
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  const dayCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return dayCount <= 30;
}, { message: "Trip cannot exceed 30 days", path: ["endDate"] });


export const TravelSegmentSchema = z.object({
  originPlaceId: z.string().optional(),
  destinationPlaceId: z.string().optional(),
  departureTime: z.date(),
  arrivalTime: z.date(),
  transportMode: z.string(),
}).refine(data => data.arrivalTime > data.departureTime, {
  message: "Arrival time must be after departure time",
  path: ["arrivalTime"]
});


export const TripAccommodationSchema = z.object({
  placeId: z.string(),
  checkIn: z.date(),
  checkOut: z.date(),
}).refine(data => data.checkOut > data.checkIn, {
  message: "Check-out time must be after check-in time",
  path: ["checkOut"]
});

