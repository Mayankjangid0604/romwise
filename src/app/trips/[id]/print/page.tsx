import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatTripDates } from "@/lib/date-utils";
import { formatInr } from "@/components/ui";
import { PrintTrigger } from "./print-trigger";
import { imageProvider } from "@/lib/providers/images";

export default async function PrintTripPage(props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await props.params;

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      groupMembers: { include: { user: true } },
      travelSegments: { orderBy: { departureDate: "asc" } },
      packingItems: { orderBy: { category: "asc" } },
      itineraryDays: {
        orderBy: { dayNumber: "asc" },
        include: {
          items: { orderBy: { startTime: "asc" } },
        }
      }
    },
  });

  if (!trip) redirect("/dashboard");

  const isMember = trip.groupMembers.some((m) => m.userId === session.user!.id);
  if (!isMember) redirect("/dashboard");

  const destinationImage = await imageProvider.searchDestinationImage(trip.destination);

  return (
    <div className="min-h-screen bg-white print:bg-white text-black p-8 max-w-4xl mx-auto font-sans">
      <PrintTrigger />
      
      {/* Print-specific styles to hide app shell and navigation */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white !important; }
          nav, header, footer, .app-shell-sidebar, .no-print { display: none !important; }
          .page-break { page-break-before: always; }
          .avoid-break { page-break-inside: avoid; }
        }
      `}} />

      {/* Hero / Cover */}
      <div className="text-center mb-12 avoid-break">
        <h1 className="text-5xl font-bold mb-4">{trip.title}</h1>
        <p className="text-2xl text-gray-600 mb-2">{trip.destination}</p>
        <p className="text-lg text-gray-500 mb-6">{formatTripDates(trip)}</p>
        
        {destinationImage && (
          <div className="w-full h-64 relative overflow-hidden rounded-xl mb-6">
            <img src={destinationImage.url} alt={trip.destination} className="w-full h-full object-cover" />
            {destinationImage.authorName && (
              <div className="absolute bottom-2 right-4 text-xs text-white/80 bg-black/50 px-2 py-1 rounded text-right">
                <div>Photo by <a href={destinationImage.authorUrl} target="_blank" rel="noreferrer" className="underline">{destinationImage.authorName}</a> on <a href={destinationImage.sourceUrl || "#"} target="_blank" rel="noreferrer" className="underline">{destinationImage.source}</a></div>
                <div className="text-[10px] opacity-75">{destinationImage.license || "License not recorded"}</div>
              </div>
            )}
          </div>
        )}
        
        <div className="flex flex-wrap justify-center gap-4 text-sm mt-4">
          <div className="bg-gray-100 px-4 py-2 rounded-lg"><strong>Budget:</strong> {formatInr(trip.budgetInr)}</div>
          <div className="bg-gray-100 px-4 py-2 rounded-lg"><strong>Pace:</strong> <span className="capitalize">{trip.paceLevel}</span></div>
          <div className="bg-gray-100 px-4 py-2 rounded-lg"><strong>Travelers:</strong> {trip.groupMembers.length}</div>
        </div>
      </div>

      <hr className="my-8 border-gray-200" />

      {/* Itinerary */}
      {trip.itineraryDays.length > 0 && (
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Itinerary</h2>
          <div className="space-y-8">
            {trip.itineraryDays.map(day => (
              <div key={day.id} className="avoid-break border border-gray-200 rounded-xl p-6">
                <div className="flex justify-between items-end border-b border-gray-200 pb-4 mb-4">
                  <h3 className="text-2xl font-semibold">Day {day.dayNumber}</h3>
                  <span className="text-gray-500 font-medium">
                    {day.date ? new Date(day.date).toLocaleDateString() : ""}
                  </span>
                </div>
                
                {day.items.length > 0 ? (
                  <div className="space-y-4">
                    {day.items.map(item => (
                      <div key={item.id} className="flex gap-4">
                        <div className="w-20 shrink-0 text-sm font-semibold text-gray-500">
                          {item.startTime || ""}
                        </div>
                        <div>
                          <h4 className="font-bold text-lg">{item.title}</h4>
                          {item.description && <p className="text-gray-600 mt-1">{item.description}</p>}
                          {item.estimatedCostInr ? (
                            <p className="text-sm text-gray-500 mt-1 font-medium">Estimated: {formatInr(item.estimatedCostInr)}</p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 italic">No activities planned.</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transit */}
      {trip.travelSegments.length > 0 && (
        <div className="mb-12 avoid-break">
          <h2 className="text-3xl font-bold mb-6">Travel & Transit</h2>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="p-4 font-semibold text-gray-600">Mode</th>
                  <th className="p-4 font-semibold text-gray-600">Origin</th>
                  <th className="p-4 font-semibold text-gray-600">Destination</th>
                  <th className="p-4 font-semibold text-gray-600">Date/Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {trip.travelSegments.map(ts => (
                  <tr key={ts.id}>
                    <td className="p-4 capitalize font-medium">{ts.mode.toLowerCase()}</td>
                    <td className="p-4">{ts.originName}</td>
                    <td className="p-4">{ts.destinationName}</td>
                    <td className="p-4">
                      {ts.departureDate ? new Date(ts.departureDate).toLocaleDateString() : ""} {ts.departureTime}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Packing List */}
      {trip.packingItems.length > 0 && (
        <div className="avoid-break mb-12">
          <h2 className="text-3xl font-bold mb-6">Packing List</h2>
          <div className="columns-2 gap-8">
            {Object.entries(
              trip.packingItems.reduce((acc, item) => {
                if (!acc[item.category]) acc[item.category] = [];
                acc[item.category].push(item);
                return acc;
              }, {} as Record<string, typeof trip.packingItems>)
            ).map(([category, items]) => (
              <div key={category} className="mb-6 avoid-break">
                <h4 className="font-bold text-lg mb-3 border-b border-gray-200 pb-2">{category}</h4>
                <ul className="space-y-2">
                  {items.map(item => (
                    <li key={item.id} className="flex gap-2 items-start">
                      <div className="w-4 h-4 rounded border border-gray-400 mt-1 shrink-0"></div>
                      <span className={item.checked ? "line-through text-gray-400" : ""}>
                        {item.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
      
    </div>
  );
}
