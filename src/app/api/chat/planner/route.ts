import { NextResponse } from "next/server";
import { AIGateway } from "@/lib/ai/gateway";
import { auth } from "@/lib/auth";
import { checkRateLimitDb } from "@/lib/db-rate-limit";
import { z } from "zod";
import { resolveDestination, searchTravelDestinations } from "@/lib/destination-resolver";

export const maxDuration = 60;

const preferenceItemSchema = z.object({
  category: z.string().min(1),
  priority: z.enum(["must-have", "very-important", "preferred", "nice-to-have", "avoid", "never"]),
});

const travelerCompositionSchema = z.object({
  adults: z.number().optional(),
  seniors: z.number().optional(),
  children: z.number().optional(),
  tripPurpose: z.enum(["leisure", "pilgrimage", "adventure", "business", "honeymoon", "family_vacation", "other"]).optional(),
  foodPreference: z.enum(["veg", "nonveg", "both"]).optional(),
});

const extractedDataSchema = z.object({
  destination: z.string().optional(),
  tripType: z.enum(["ONE_DAY", "MULTI_DAY", "FLEXIBLE", "PICNIC", "DAY_TRIP", "OVERNIGHT", "WEEKEND"]).optional(),
  timeStatus: z.enum(["EXACT", "FLEXIBLE", "UNKNOWN"]).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  // Multi-destination / round trip
  waypoints: z.array(z.string()).optional(),         // e.g. ["Vaishno Devi", "Srinagar", "Sonmarg"]
  isRoundTrip: z.boolean().optional(),
  returnDestination: z.string().optional(),           // "Srinagar" if flying back from there
  travelSegments: z.array(z.object({
    mode: z.string(),
    arrivalDate: z.string().optional(),
    arrivalTime: z.string().optional(),
    departureDate: z.string().optional(),
    departureTime: z.string().optional(),
    origin: z.string().optional(),
    destination: z.string().optional()
  })).optional(),
  accommodations: z.array(z.object({
    name: z.string(),
    checkInDate: z.string().optional(),
    checkInTime: z.string().optional(),
    checkOutDate: z.string().optional(),
    checkOutTime: z.string().optional(),
    location: z.string().optional()
  })).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budgetInr: z.number().optional(),
  paceLevel: z.enum(["easy", "balanced", "full"]).optional(),
  maxTravelers: z.number().optional(),
  travelerComposition: travelerCompositionSchema.optional(),
  preferences: z.array(preferenceItemSchema).optional(),
  accessibilityNotes: z.string().optional(),
  constraints: z.object({
    avoid: z.array(z.string()).optional(),
  }).optional(),
});

const plannerResponseSchema = z.object({
  type: z.enum(["question", "complete"]),
  message: z.string().min(1),
  extractedData: extractedDataSchema.optional(),
  fallbackDestinations: z.array(z.object({
    id: z.string(),
    name: z.string()
  })).optional(),
});

export type PlannerExtractedData = z.infer<typeof extractedDataSchema>;
export type PlannerPreferenceItem = z.infer<typeof preferenceItemSchema>;
export type TravelerComposition = z.infer<typeof travelerCompositionSchema>;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const rateLimitKey = `chat-planner:${session.user.id}:${ip}`;
    const { allowed, retryAfterSeconds } = await checkRateLimitDb(rateLimitKey);

    if (!allowed) {
      return NextResponse.json(
        { error: `Too many requests. Please try again in ${retryAfterSeconds} seconds.` },
        { 
          status: 429,
          headers: {
            "Retry-After": retryAfterSeconds.toString(),
            "X-RateLimit-Reset": (Date.now() + retryAfterSeconds * 1000).toString(),
          }
        }
      );
    }

    const { messages } = await req.json();

    if (!Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid messages format" }, { status: 400 });
    }

    // E2E AI mock — deterministic response for browser testing
    if (process.env.E2E_TEST_MODE === "true" && process.env.E2E_AI_MOCK === "true") {
      const lastUserMessage = messages.findLast((m: { role: string }) => m.role === "user");
      const content = (lastUserMessage?.content ?? "").toLowerCase();

      const isComplete = content.includes("goa") || content.includes("jaipur") || content.includes("manali") ||
        content.includes("kerala") || content.includes("tokyo") || content.includes("days") ||
        (content.includes("budget") && content.includes("people"));

      if (isComplete) {
        let destination = "Goa";
        if (content.includes("jaipur")) destination = "Jaipur";
        else if (content.includes("manali")) destination = "Manali";
        else if (content.includes("kerala")) destination = "Kerala";
        else if (content.includes("tokyo")) destination = "Tokyo";

        const travelersMatch = content.match(/(\d+)\s+(?:people|person|traveler)/);
        const maxTravelers = travelersMatch ? parseInt(travelersMatch[1]) : 2;

        const budgetMatch = content.match(/(?:budget|₹)\s*:?\s*(\d[\d,]*)/i);
        const budgetInr = budgetMatch ? parseInt(budgetMatch[1].replace(/,/g, "")) : 50000;

        const preferences: PlannerPreferenceItem[] = [];
        if (content.includes("food") || content.includes("dining")) {
          preferences.push({ category: "dining", priority: "preferred" });
        }
        if (content.includes("culture")) {
          preferences.push({ category: "culture", priority: "preferred" });
        }
        
        let accessibilityNotes: string | undefined = undefined;
        if (content.includes("wheelchair")) {
          accessibilityNotes = "wheelchair";
        }

        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() + 30);
        const endDate = new Date(startDate);
        const daysMatch = content.match(/(\d+)\s+days?/);
        const days = daysMatch ? parseInt(daysMatch[1]) : 3;
        endDate.setDate(endDate.getDate() + days - 1);

        let tripType = "MULTI_DAY";
        if (content.includes("picnic")) tripType = "PICNIC";
        else if (content.includes("overnight")) tripType = "OVERNIGHT";
        else if (content.includes("weekend")) tripType = "WEEKEND";
        else if (content.includes("day trip") || content.includes("one day")) tripType = "DAY_TRIP";

        let paceLevel: "easy" | "balanced" | "full" = "balanced";
        if (content.includes("full") || content.includes("packed")) paceLevel = "full";
        else if (content.includes("easy") || content.includes("relaxed")) paceLevel = "easy";

        return NextResponse.json({
          type: "complete",
          message: `Perfect! I've got everything I need. Here's your trip summary: ${days} days in ${destination} for ${maxTravelers} ${maxTravelers === 1 ? "person" : "people"}, budget ₹${budgetInr.toLocaleString()}. Ready to create your itinerary!`,
          extractedData: {
            destination,
            startDate: startDate.toISOString().split("T")[0],
            endDate: endDate.toISOString().split("T")[0],
            budgetInr,
            paceLevel,
            maxTravelers,
            tripType,
            preferences: preferences.length > 0 ? preferences : undefined,
            accessibilityNotes,
          },
        });
      }

      return NextResponse.json({
        type: "question",
        message: "Great! I'm here to help plan your trip. Where would you like to go, and how many days are you thinking?",
        extractedData: undefined,
      });
    }

    // Format chat history for prompt
    const chatHistory = messages
      .map((m: { role: string; content: string }) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");

    const systemInstruction = `
You are Roamwise, a smart AI travel planning assistant. Your goal is to gather the necessary details to create a personalised trip plan.

INFORMATION TO GATHER (ask naturally, 1-2 questions at a time — do NOT repeat questions already answered):

REQUIRED:
1. Primary destination (and any additional stops / waypoints if it's a multi-destination trip)
2. Is it a round trip? (Do they return from the same city, or a different one?)
3. Travel dates or approximate duration
4. Budget in INR (or convert from other currencies / vague terms: cheap≈30000, medium≈70000, luxury≈200000)
5. Number of travelers + who they are (solo, couple, family — any children, seniors?)
6. Pace level: Easy/relaxed, Balanced, or Full/packed

OPTIONAL (ask if relevant, don't force):
7. Traveler composition: How many adults, any children (ages), any seniors? What's the occasion (pilgrimage, honeymoon, adventure, family vacation)?
8. Food preference: vegetarian-only, non-veg OK, or no preference?
9. Interests / preferences (what they enjoy: culture, food, adventure, nature, shopping, relaxation, nightlife)
10. Things to avoid (crowded places, museums, etc.)
11. Accessibility needs (wheelchair, low walking, traveling with infants)
12. Specific arrival/departure times, flight details, hotel check-in/check-out

MULTI-DESTINATION TRIPS:
- If the user mentions multiple places (e.g. "Vaishno Devi then Srinagar and Sonmarg"), recognize this as a multi-destination trip.
- Extract the PRIMARY destination (first stop) into "destination"
- Extract intermediate stops into "waypoints" array
- Ask if they're returning from the last stop or a different city → extract to "returnDestination"
- Ask "Is this a round trip?" → extract "isRoundTrip"

RULES:
- Be friendly, concise, and enthusiastic.
- NEVER repeat a question if the user already answered it in a previous message.
- Build on what you already know — don't start fresh each turn.
- If the user provides many details at once, acknowledge them and only ask about the truly missing parts.
- Do NOT show raw JSON in your message text.
- Once you have Destination, Dates/Duration, Budget, Pace, and Travelers — set type="complete".
- If duration given without dates, pick a default start date next month and calculate end date.
- CRITICAL: If user gives an explicit number for budget (e.g. "budget 80000"), extract EXACTLY that number into budgetInr.
- For multi-destination: primary destination = first stop. All stops listed in waypoints.

DESTINATION EXTRACTION RULES (CRITICAL — follow exactly):
- "destination" MUST be a SINGLE city or place name. Never combine cities.
  ✅ CORRECT: destination="Srinagar", waypoints=["Gulmarg", "Pahalgam"]
  ❌ WRONG:   destination="Srinagar and Gulmarg"  ← this breaks the system
  ❌ WRONG:   destination="Kashmir and Sonmarg"   ← this breaks the system
- For a trip like "Vaishno Devi, Srinagar, Sonmarg" → destination="Vaishno Devi", waypoints=["Srinagar", "Sonmarg"]
- For a trip like "Kashmir" → destination="Srinagar" (use the main city of the region)
- Known Kashmir destinations: Srinagar, Gulmarg, Pahalgam, Kashmir Valley
- For single-destination trips, waypoints should be omitted or []

TRIP TYPE CLASSIFICATION:
- PICNIC: few hours outing, no overnight stay
- DAY_TRIP / ONE_DAY: full day, returns same evening
- OVERNIGHT: one night away
- WEEKEND: Sat-Sun getaway (~2 days)
- MULTI_DAY: explicit multi-day with start+end dates
- FLEXIBLE: user doesn't know dates yet

TRANSPORT INTELLIGENCE (travelSegments):
- If the user explicitly provides flight/train/bus details, you may extract them.
- Do NOT fabricate or generate speculative travel segments. If the user does not provide them, leave travelSegments empty. We will determine routing deterministically.
- Hotel check-in/out → extract into accommodations

Output ONLY valid JSON (no markdown, no code fences):
{
  "type": "question" | "complete",
  "message": "Your conversational reply to the user",
  "extractedData": {
    "destination": "SINGLE city or place name ONLY — e.g. 'Srinagar' or 'Vaishno Devi'. NEVER a combined string like 'Kashmir and Sonmarg' or 'Srinagar and Gulmarg'.",
    "waypoints": ["Each additional stop as a separate single city name"],
    "isRoundTrip": true | false,
    "returnDestination": "City to fly/drive back from (if different from origin)",
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "tripType": "PICNIC" | "DAY_TRIP" | "ONE_DAY" | "OVERNIGHT" | "WEEKEND" | "MULTI_DAY" | "FLEXIBLE",
    "timeStatus": "EXACT" | "FLEXIBLE" | "UNKNOWN",
    "startTime": "HH:MM",
    "endTime": "HH:MM",
    "travelSegments": [
      { "mode": "flight", "arrivalDate": "YYYY-MM-DD", "arrivalTime": "HH:MM", "departureDate": "YYYY-MM-DD", "departureTime": "HH:MM", "origin": "string", "destination": "string" }
    ],
    "accommodations": [
      { "name": "Hotel Name", "checkInDate": "YYYY-MM-DD", "checkInTime": "HH:MM", "checkOutDate": "YYYY-MM-DD", "checkOutTime": "HH:MM", "location": "string" }
    ],
    "budgetInr": 50000,
    "paceLevel": "easy" | "balanced" | "full",
    "maxTravelers": 2,
    "travelerComposition": {
      "adults": 2,
      "seniors": 1,
      "children": 1,
      "tripPurpose": "leisure" | "pilgrimage" | "adventure" | "business" | "honeymoon" | "family_vacation" | "other",
      "foodPreference": "veg" | "nonveg" | "both"
    },
    "preferences": [
      { "category": "dining", "priority": "preferred" },
      { "category": "culture", "priority": "never" }
    ],
    "accessibilityNotes": "string",
    "constraints": { "avoid": ["museums"] }
  }
}
`;

    const prompt = `Here is the conversation so far:\n${chatHistory}\n\nWhat is your next response?`;

    const result = await AIGateway.generateStructured<unknown>({
      prompt,
      systemInstruction,
      context: {
        userId: session.user.id,
        task: "conversation",
      }
    });

    const parsed = plannerResponseSchema.safeParse(result.data);
    if (!parsed.success) {
      console.error("AI returned invalid structure:", result.data, parsed.error);
      return NextResponse.json({ error: "Invalid response from AI" }, { status: 502 });
    }

    if (parsed.data.type === "complete" && parsed.data.extractedData?.destination) {
      const destination = parsed.data.extractedData.destination;
      const resolved = await resolveDestination(destination, true);
      
      if (!resolved) {
        // Fallback intelligence
        const nearby = await searchTravelDestinations("", 5);
        const nearbyNames = nearby.map(d => d.name).join(", ");
        
        parsed.data.type = "question";
        parsed.data.extractedData = undefined;
        parsed.data.message = `We don't currently have enough verified travel data for ${destination}. Did you mean something else? Nearby supported destinations include: ${nearbyNames}. Where would you like to go instead?`;
        
        // Populate structured fallbackDestinations for the UI to render as pills/buttons
        parsed.data.fallbackDestinations = nearby.map(d => ({ id: d.id, name: d.name }));
      }
    }

    return NextResponse.json(parsed.data);
  } catch (error) {
    console.error("Chat planner error:", error);
    return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
  }
}
