import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GoogleGenAI, Type, Schema } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const CopilotResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    message: {
      type: Type.STRING,
      description: "A friendly response to the user explaining what action was taken.",
    },
    intent: {
      type: Type.OBJECT,
      properties: {
        action: {
          type: Type.STRING,
          enum: ["ADD", "REMOVE", "REPLACE", "NO_ACTION"],
          description: "The type of edit to perform.",
        },
        targetItemTitle: {
          type: Type.STRING,
          description: "The title of the itinerary item to target (for REMOVE or REPLACE).",
        },
        targetDayNumber: {
          type: Type.INTEGER,
          description: "The day number to add the new item to (for ADD).",
        },
        newPlaceKeyword: {
          type: Type.STRING,
          description: "The keyword to search for the new place (for ADD or REPLACE), e.g., 'museum', 'cafe', 'hike'.",
        },
      },
      required: ["action"],
    },
  },
  required: ["message", "intent"],
};

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tripId, message } = await req.json();

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        itineraryDays: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const isMember = await prisma.groupMember.findFirst({
      where: { tripId, userId: session.user.id },
    });
    if (!isMember) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Build context for the AI
    const itineraryContext = trip.itineraryDays
      .map((day) => {
        return `Day ${day.dayNumber}:\n` + day.items.map((item) => `- ${item.title} (${item.category})`).join("\n");
      })
      .join("\n\n");

    const prompt = `
You are Roamwise AI Copilot, assisting a user with editing their trip itinerary.
Destination: ${trip.destination}

Current Itinerary:
${itineraryContext || "Empty itinerary"}

User Request: "${message}"

Determine the user's intent to edit the itinerary. Return a friendly message and a structured intent.
If the user wants to add an activity, set action to ADD, provide a targetDayNumber, and a newPlaceKeyword.
If the user wants to remove an activity, set action to REMOVE and provide the exact targetItemTitle.
If the user wants to swap an activity, set action to REPLACE, provide the exact targetItemTitle, and a newPlaceKeyword.
If no edit is needed, set action to NO_ACTION.
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: CopilotResponseSchema,
      },
    });

    const resultText = response.text;
    if (!resultText) throw new Error("No response from AI");

    const parsed = JSON.parse(resultText);

    // Apply the intent to the database if applicable
    const intent = parsed.intent;
    let appliedMessage = parsed.message;

    if (intent.action === "REMOVE" && intent.targetItemTitle) {
      const targetItem = trip.itineraryDays.flatMap(d => d.items).find(i => i.title.toLowerCase().includes(intent.targetItemTitle.toLowerCase()));
      if (targetItem) {
        await prisma.itineraryItem.delete({ where: { id: targetItem.id } });
        appliedMessage = `I have removed ${targetItem.title} from your itinerary.`;
      } else {
        appliedMessage = `I couldn't find an activity named "${intent.targetItemTitle}" to remove.`;
      }
    } else if (intent.action === "ADD" && intent.targetDayNumber && intent.newPlaceKeyword) {
      const day = trip.itineraryDays.find(d => d.dayNumber === intent.targetDayNumber);
      if (day) {
        // Find a place in the destination that matches the keyword
        const dest = await prisma.travelDestination.findFirst({
          where: { name: trip.destination },
          include: { places: { where: { description: { contains: intent.newPlaceKeyword } } } }
        });
        const place = dest?.places?.[0];
        
        if (place) {
          await prisma.itineraryItem.create({
            data: {
              itineraryDayId: day.id,
              title: place.name,
              description: place.description || "",
              category: place.category,
              startTime: "10:00",
              endTime: "12:00",
              estimatedCostInr: place.typicalCostInr || 0,
              order: day.items.length,
              placeId: place.id,
              reasoning: "Added by Copilot",
            }
          });
          appliedMessage = `I have added ${place.name} to Day ${intent.targetDayNumber}.`;
        } else {
           // Fallback if no place matches
           await prisma.itineraryItem.create({
            data: {
              itineraryDayId: day.id,
              title: `Explore ${intent.newPlaceKeyword}`,
              description: `Recommended activity based on: ${intent.newPlaceKeyword}`,
              category: "sightseeing",
              startTime: "10:00",
              endTime: "12:00",
              order: day.items.length,
              reasoning: "Added by Copilot",
            }
          });
          appliedMessage = `I have added a placeholder for "${intent.newPlaceKeyword}" on Day ${intent.targetDayNumber}.`;
        }
      }
    } else if (intent.action === "REPLACE" && intent.targetItemTitle && intent.newPlaceKeyword) {
        const targetItem = trip.itineraryDays.flatMap(d => d.items).find(i => i.title.toLowerCase().includes(intent.targetItemTitle.toLowerCase()));
        if (targetItem) {
            // Very simple replace logic: just update title and description
            await prisma.itineraryItem.update({
                where: { id: targetItem.id },
                data: {
                    title: `New Activity: ${intent.newPlaceKeyword}`,
                    description: `Replaced ${targetItem.title} with something related to ${intent.newPlaceKeyword}.`
                }
            });
            appliedMessage = `I have replaced ${targetItem.title}.`;
        }
    }

    return NextResponse.json({ message: appliedMessage, intent });

  } catch (err) {
    console.error("Copilot Error:", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
