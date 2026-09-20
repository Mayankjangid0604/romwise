import { NextResponse } from "next/server";
import { AIGateway } from "@/lib/ai/gateway";
import { auth } from "@/lib/auth";
import { checkRateLimitDb } from "@/lib/db-rate-limit";
import { z } from "zod";

export const maxDuration = 60;

const preferenceItemSchema = z.object({
  category: z.string().min(1),
  priority: z.enum(["must-have", "very-important", "preferred", "nice-to-have", "avoid", "never"]),
});

const extractedDataSchema = z.object({
  destination: z.string().optional(),
  tripType: z.enum(["ONE_DAY", "MULTI_DAY", "FLEXIBLE", "PICNIC", "DAY_TRIP", "OVERNIGHT", "WEEKEND"]).optional(),
  timeStatus: z.enum(["EXACT", "FLEXIBLE", "UNKNOWN"]).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
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
});

export type PlannerExtractedData = z.infer<typeof extractedDataSchema>;
export type PlannerPreferenceItem = z.infer<typeof preferenceItemSchema>;

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
    // Only active when BOTH E2E_TEST_MODE and E2E_AI_MOCK are set
    if (process.env.E2E_TEST_MODE === "true" && process.env.E2E_AI_MOCK === "true") {
      // messages is already available from req.json() earlier
      const lastUserMessage = messages.findLast((m: { role: string }) => m.role === "user");
      const content = (lastUserMessage?.content ?? "").toLowerCase();

      // Detect if this looks like a complete trip request and return complete state
      const isComplete = content.includes("goa") || content.includes("jaipur") || content.includes("manali") ||
        content.includes("kerala") || content.includes("tokyo") || content.includes("days") ||
        (content.includes("budget") && content.includes("people"));

      if (isComplete) {
        // Parse destination from message
        let destination = "Goa";
        if (content.includes("jaipur")) destination = "Jaipur";
        else if (content.includes("manali")) destination = "Manali";
        else if (content.includes("kerala")) destination = "Kerala";
        else if (content.includes("tokyo")) destination = "Tokyo";

        // Parse travelers
        const travelersMatch = content.match(/(\d+)\s+(?:people|person|traveler)/);
        const maxTravelers = travelersMatch ? parseInt(travelersMatch[1]) : 2;

        // Parse budget
        const budgetMatch = content.match(/(?:budget|₹)\s*:?\s*(\d[\d,]*)/i);
        const budgetInr = budgetMatch ? parseInt(budgetMatch[1].replace(/,/g, "")) : 50000;

        // Parse preferences from message
        const preferences: PlannerPreferenceItem[] = [];
        if (content.includes("food") || content.includes("dining")) {
          preferences.push({ category: "dining", priority: "preferred" });
        }
        if (content.includes("culture") || content.includes("cultural")) {
          preferences.push({ category: "culture", priority: "preferred" });
        }
        if (content.includes("outdoor") || content.includes("nature") || content.includes("adventure")) {
          preferences.push({ category: "nature", priority: "preferred" });
        }
        if (content.includes("avoid museum") || content.includes("no museum")) {
          preferences.push({ category: "culture", priority: "never" });
        }

        // Parse accessibility
        let accessibilityNotes = "";
        if (content.includes("wheelchair")) accessibilityNotes = "wheelchair accessible required";
        else if (content.includes("low walk") || content.includes("minimal walk")) accessibilityNotes = "low walking";
        else if (content.includes("senior") || content.includes("elderly")) accessibilityNotes = "senior travelers";

        // Parse dates
        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() + 30);
        const endDate = new Date(startDate);
        const daysMatch = content.match(/(\d+)\s+days?/);
        const days = daysMatch ? parseInt(daysMatch[1]) : 3;
        endDate.setDate(endDate.getDate() + days - 1);

        // Parse tripType
        let tripType = "MULTI_DAY";
        if (content.includes("picnic")) tripType = "PICNIC";
        else if (content.includes("overnight")) tripType = "OVERNIGHT";
        else if (content.includes("weekend")) tripType = "WEEKEND";
        else if (content.includes("day trip") || content.includes("one day")) tripType = "DAY_TRIP";
        else if (content.includes("flexible")) tripType = "FLEXIBLE";

        // Parse pace
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
            accessibilityNotes: accessibilityNotes || undefined,
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
You are Roamwise, an AI travel planning assistant.
Your goal is to gather the necessary details to create a trip.
You MUST gather the following details, asking one or two questions at a time in a natural, conversational way:
1. Destination (Where are they going?)
2. Dates or approximate duration (When? or How many days?)
3. Budget (e.g., $1000, "cheap", "luxury")
4. Pace level (Easy/relaxed, Balanced, or Full/packed)
5. Number of travelers (Who is going? Solo, couple, family of 4?)
6. Any accessibility or special needs (Optional: wheelchair, low walking, senior travelers, traveling with kids)
7. Preferences (Optional: what they enjoy — food, culture, adventure, nature, shopping, relaxation — and what to avoid)

8. Logistics (Optional): If the user mentions their flight, train, bus, or driving arrival/departure times, extract them into travelSegments. If they mention hotel check-in/out times, extract them into accommodations. If they mention specific start or end times for the trip (e.g. "We only have from 10 AM to 4 PM"), extract them to startTime and endTime.
9. Trip Type & Time Status: Classify tripType as:
   - "PICNIC"    — a few hours outing (e.g. "picnic", "afternoon trip", "half-day outing"). No overnight stay.
   - "DAY_TRIP"  — exactly one day, returns same evening (e.g. "day trip", "one day", "day visit").
   - "ONE_DAY"   — same as DAY_TRIP (use when user explicitly says "one day trip" without "picnic" framing).
   - "OVERNIGHT" — one night away (e.g. "overnight trip", "quick overnight", "one night").
   - "WEEKEND"   — weekend getaway, Saturday–Sunday (e.g. "weekend trip", "weekend getaway", "2 days").
   - "MULTI_DAY" — explicit multi-day trip with specific start+end dates mentioned.
   - "FLEXIBLE"  — user doesn't know dates yet or says "flexible dates".
   Classify timeStatus as "EXACT" (known times), "FLEXIBLE", or "UNKNOWN".

Rules:
- Be friendly, enthusiastic, and brief.
- If the user provides multiple pieces of information at once, acknowledge them and ask about the missing parts.
- Do NOT output your internal state or JSON directly in your message.
- Once you have gathered enough information to confidently determine Destination, Start/End Dates (or duration), Budget (in INR), Pace Level, and Travelers, set type="complete".
- If the user gives a duration (e.g. "5 days") and no start date, pick a default start date (e.g. next month) and calculate the end date.
- Convert budget to a reasonable INR number if given as text like "cheap" or in another currency. (e.g., cheap = 30000, medium = 70000, luxury = 150000).
- CRITICAL: If the user explicitly states a number for the budget (e.g., "100000" or "budget 50000"), you MUST extract that EXACT number into budgetInr. Do not modify explicit numbers.
- If the user says "just decide for me", make reasonable assumptions.
- Extract preferences carefully: "I love food and culture" → preferences with dining/culture preferred. "Avoid museums" → culture with priority "never". "I enjoy outdoor activities" → nature/adventure preferred.
- Extract accessibility needs: "low walking", "wheelchair", "senior", "traveling with kids" → put in accessibilityNotes.

Output JSON format:
{
  "type": "question" | "complete",
  "message": "Your conversational reply to the user",
  "extractedData": {
    "destination": "string (only if known)",
    "startDate": "YYYY-MM-DD (only if known)",
    "endDate": "YYYY-MM-DD (only if known)",
    "tripType": "PICNIC" | "DAY_TRIP" | "ONE_DAY" | "OVERNIGHT" | "WEEKEND" | "MULTI_DAY" | "FLEXIBLE",
    "timeStatus": "EXACT" | "FLEXIBLE" | "UNKNOWN",
    "startTime": "HH:MM (24-hour, if given)",
    "endTime": "HH:MM (24-hour, if given)",
    "travelSegments": [ { "mode": "flight", "arrivalDate": "YYYY-MM-DD", "arrivalTime": "HH:MM", "departureDate": "YYYY-MM-DD", "departureTime": "HH:MM", "origin": "string", "destination": "string" } ],
    "accommodations": [ { "name": "Hotel Name", "checkInDate": "YYYY-MM-DD", "checkInTime": "HH:MM", "checkOutDate": "YYYY-MM-DD", "checkOutTime": "HH:MM", "location": "string" } ],
    "budgetInr": 50000 (number, only if known),
    "paceLevel": "easy" | "balanced" | "full" (only if known),
    "maxTravelers": 2 (number, only if known),
    "preferences": [
      { "category": "dining", "priority": "preferred" },
      { "category": "culture", "priority": "never" }
    ] (only if mentioned — use categories: dining, culture, nature, adventure, sightseeing, shopping, relaxation, nightlife),
    "accessibilityNotes": "string describing any mobility/accessibility needs (only if mentioned)",
    "constraints": {
      "avoid": ["museums", "crowded places"] (only if user explicitly asked to avoid something)
    }
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

    return NextResponse.json(parsed.data);
  } catch (error) {
    console.error("Chat planner error:", error);
    return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
  }
}
