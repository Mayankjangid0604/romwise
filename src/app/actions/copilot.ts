"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AIGateway } from "@/lib/ai/gateway";
import { revalidatePath } from "next/cache";

export type CopilotIntentResult = 
  | { success: true; message: string; action: string }
  | { success: false; error: string };

export type TripEditIntent = 
  | { action: "ADD_PLACE"; targetDayNumber: number; newPlaceKeyword: string }
  | { action: "REMOVE_ITEM"; targetItemTitle: string }
  | { action: "REPLACE_ITEM"; targetItemTitle: string; newPlaceKeyword: string }
  | { action: "NO_ACTION" };

export interface CopilotSchemaOutput {
  message: string;
  intent: TripEditIntent;
}

const copilotSchema = {
  type: "OBJECT",
  properties: {
    message: {
      type: "STRING",
      description: "A friendly response to the user explaining what action was taken.",
    },
    intent: {
      type: "OBJECT",
      properties: {
        action: {
          type: "STRING",
          enum: ["ADD_PLACE", "REMOVE_ITEM", "REPLACE_ITEM", "NO_ACTION"],
          description: "The type of edit to perform.",
        },
        targetItemTitle: {
          type: "STRING",
          description: "The title of the itinerary item to target (for REMOVE_ITEM or REPLACE_ITEM).",
        },
        targetDayNumber: {
          type: "INTEGER",
          description: "The day number to add the new item to (for ADD_PLACE).",
        },
        newPlaceKeyword: {
          type: "STRING",
          description: "The keyword to search for the new place (for ADD_PLACE or REPLACE_ITEM), e.g., 'museum', 'cafe', 'hike'.",
        },
      },
      required: ["action"],
    },
  },
  required: ["message", "intent"],
};

export async function executeCopilotIntent(tripId: string, message: string): Promise<CopilotIntentResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  // Authorize user
  const member = await prisma.groupMember.findFirst({
    where: { tripId, userId: session.user.id },
  });
  if (!member) {
    return { success: false, error: "Unauthorized: Not a member" };
  }
  if (member.role === "viewer") {
    return { success: false, error: "Unauthorized: Viewers cannot modify the itinerary" };
  }

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      itineraryDays: {
        include: { items: true },
      },
    },
  });

  if (!trip) {
    return { success: false, error: "Trip not found" };
  }

  // Build context
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
If the user wants to add an activity, set action to ADD_PLACE, provide a targetDayNumber, and a newPlaceKeyword.
If the user wants to remove an activity, set action to REMOVE_ITEM and provide the exact targetItemTitle.
If the user wants to swap an activity, set action to REPLACE_ITEM, provide the exact targetItemTitle, and a newPlaceKeyword.
If no edit is needed, set action to NO_ACTION.
`;

  try {
    const result = await AIGateway.generateStructured<CopilotSchemaOutput>({
      prompt,
      context: { task: "copilot", tripId, userId: session.user.id },
      schema: copilotSchema,
    });

    const parsed = result.data;
    const intent = parsed.intent;
    let appliedMessage = parsed.message;
    let actionTaken = intent.action;

    // Prisma modifications
    if (intent.action === "REMOVE_ITEM") {
      const targetTitle = intent.targetItemTitle.toLowerCase();
      const targetItem = trip.itineraryDays.flatMap(d => d.items).find(i => i.title.toLowerCase().includes(targetTitle));
      if (targetItem) {
        // Enforce boundary: must belong to THIS trip
        await prisma.itineraryItem.delete({ where: { id: targetItem.id } });
        appliedMessage = `I have removed ${targetItem.title} from your itinerary.`;
      } else {
        appliedMessage = `I couldn't find an activity named "${intent.targetItemTitle}" to remove.`;
        actionTaken = "NO_ACTION";
      }
    } else if (intent.action === "ADD_PLACE") {
      const day = trip.itineraryDays.find(d => d.dayNumber === intent.targetDayNumber);
      if (day) {
        // Safe database lookup: use actual entities
        const dest = await prisma.travelDestination.findFirst({
          where: { name: trip.destination },
          include: { places: { where: { description: { contains: intent.newPlaceKeyword } }, take: 1 } }
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
              estimatedCostInr: place.typicalCostInr ?? null,
              order: day.items.length,
              placeId: place.id,
              reasoning: "Added by Copilot",
            }
          });
          appliedMessage = `I have added ${place.name} to Day ${intent.targetDayNumber}.`;
        } else {
          // Generic placeholder without inventing PlaceId
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
      } else {
        appliedMessage = `I couldn't find Day ${intent.targetDayNumber} in your itinerary.`;
        actionTaken = "NO_ACTION";
      }
    } else if (intent.action === "REPLACE_ITEM") {
      const targetTitle = intent.targetItemTitle.toLowerCase();
      const targetItem = trip.itineraryDays.flatMap(d => d.items).find(i => i.title.toLowerCase().includes(targetTitle));
      if (targetItem) {
        await prisma.itineraryItem.update({
          where: { id: targetItem.id },
          data: {
            title: `New Activity: ${intent.newPlaceKeyword}`,
            description: `Replaced ${targetItem.title} with something related to ${intent.newPlaceKeyword}.`,
            placeId: null, // Clear placeId since we are overwriting it
          }
        });
        appliedMessage = `I have replaced ${targetItem.title}.`;
      } else {
        appliedMessage = `I couldn't find an activity named "${intent.targetItemTitle}" to replace.`;
        actionTaken = "NO_ACTION";
      }
    } else if (intent.action === "NO_ACTION") {
      actionTaken = "NO_ACTION";
    } else {
      // Reject unknown/unsupported
      return { success: false, error: "Unsupported operation requested by Copilot." };
    }

    if (actionTaken !== "NO_ACTION") {
      revalidatePath(`/trips/${tripId}`);
    }

    return { success: true, message: appliedMessage, action: actionTaken };

  } catch (err) {
    console.error("Copilot Action Error:", err);
    return { success: false, error: "Failed to process AI request" };
  }
}
