import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

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
        include: { items: true },
        orderBy: { dayNumber: "asc" }
      }
    },
  });

  if (!trip || !trip.groupMembers.some((m) => m.userId === session.user!.id)) {
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
        `SUMMARY:${item.title}`,
        `DESCRIPTION:${item.description}`,
        "END:VEVENT"
      );
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
