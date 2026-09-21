import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { PlaceEditForm } from "./PlaceEditForm";

export default async function AdminPlacePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  const place = await prisma.place.findUnique({
    where: { id },
    include: { destination: true, images: true }
  });

  if (!place) notFound();

  const warnings = [];
  if (place.lat === 0 && place.lng === 0) warnings.push("Missing valid coordinates.");
  if (!place.typicalCostInr) warnings.push("Missing typical cost.");
  if (!place.durationMinutes) warnings.push("Missing recommended duration.");
  if (!place.openingTime || !place.closingTime) warnings.push("Missing opening or closing times.");
  if (!place.address) warnings.push("Missing address.");
  if (!place.description) warnings.push("Missing description.");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        {warnings.length > 0 && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              ⚠️ Data Quality Warnings
            </h3>
            <ul className="list-disc pl-5 text-sm space-y-1">
              {warnings.map((warn, i) => (
                <li key={i}>{warn}</li>
              ))}
            </ul>
          </div>
        )}

        <h1 className="text-2xl font-bold text-ink-900 mb-2">{place.name}</h1>
        <p className="text-ink-600 mb-6">{place.destination.name} • {place.category}</p>

        <div className="bg-ink-50 p-6 rounded-lg border border-ink-100 mb-8 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500 mb-4">Provenance & Identity</h2>
          
          <div>
            <span className="block text-xs text-ink-500 uppercase tracking-wide">Data Source</span>
            <span className="font-medium text-ink-800 bg-ink-200 px-2 py-1 rounded text-sm capitalize">
              {place.sourceType}
            </span>
          </div>

          <div>
            <span className="block text-xs text-ink-500 uppercase tracking-wide">Source URL</span>
            {place.sourceUrl ? (
              <a href={place.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all text-sm">
                {place.sourceUrl}
              </a>
            ) : (
              <span className="text-ink-400 italic text-sm">None</span>
            )}
          </div>

          <div>
            <span className="block text-xs text-ink-500 uppercase tracking-wide">Coordinates</span>
            <span className="text-ink-800 text-sm">
              {place.lat}, {place.lng}
            </span>
          </div>
          
          <div>
            <span className="block text-xs text-ink-500 uppercase tracking-wide">Status</span>
            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
              place.dataStatus === 'VERIFIED' ? 'bg-green-100 text-green-700' :
              place.dataStatus === 'REJECTED' ? 'bg-red-100 text-red-700' :
              'bg-yellow-100 text-yellow-700'
            }`}>
              {place.dataStatus}
            </span>
          </div>
        </div>
      </div>

      <div>
        <PlaceEditForm place={place} />
      </div>
    </div>
  );
}
