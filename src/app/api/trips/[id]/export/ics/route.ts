import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

function escapeICS(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

function formatICSDate(date: Date, timeStr: string) {
  // timeStr is like "09:00"
  const [hours, minutes] = timeStr.split(":");
  const d = new Date(date);
  d.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0);
  // Format to ICS format: YYYYMMDDTHHmmssZ
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await props.params;

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      groupMembers: true,
      itineraryDays: {
        include: { 
          items: {
            include: { place: true }
          }
        },
        orderBy: { dayNumber: "asc" }
      }
    },
  });

  const isCreator = trip?.creatorId === session.user!.id;
  const isMember = trip?.groupMembers.some((m) => m.userId === session.user!.id);
  if (!trip || (!isCreator && !isMember)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Roamwise//Travel Planner//EN",
    "CALSCALE:GREGORIAN"
  ];

  for (const day of trip.itineraryDays) {
    for (const item of day.items) {
      if (!item.startTime || !item.endTime) continue;
      
      const dtStart = formatICSDate(day.date, item.startTime);
      const dtEnd = formatICSDate(day.date, item.endTime);
      
      icsContent.push(
        "BEGIN:VEVENT",
        `UID:${item.id}@roamwise.app`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${escapeICS(item.title || item.place?.name || "")}`,
        `DESCRIPTION:${escapeICS(item.description || item.place?.description || "")}`
      );
      if (item.place?.address) {
        icsContent.push(`LOCATION:${escapeICS(item.place.address)}`);
      } else if (item.place?.area) {
        icsContent.push(`LOCATION:${escapeICS(item.place.area)}`);
      }
      icsContent.push("END:VEVENT");
    }
  }

  icsContent.push("END:VCALENDAR");

  return new NextResponse(icsContent.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${trip.title.replace(/\s+/g, '_')}_itinerary.ics"`,
    },
  });
}
