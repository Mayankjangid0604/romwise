import { prisma } from "@/lib/db";
import Link from "next/link";

export default async function AdminDataDashboard() {
  const destinationCount = await prisma.travelDestination.count();
  const placeCount = await prisma.place.count();
  const placesMissingHours = await prisma.place.count({
    where: { OR: [{ openingTime: null }, { closingTime: null }] }
  });
  const placesMissingCost = await prisma.place.count({
    where: { typicalCostInr: null }
  });
  const rejectedPlaces = await prisma.place.count({
    where: { dataStatus: "REJECTED" }
  });

  const places = await prisma.place.findMany({
    take: 100,
    orderBy: { updatedAt: 'desc' },
    include: { destination: true }
  });

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-ink-100">
          <h3 className="text-xs text-ink-500 uppercase tracking-wider mb-1">Destinations</h3>
          <p className="text-2xl font-semibold text-ink-900">{destinationCount}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-ink-100">
          <h3 className="text-xs text-ink-500 uppercase tracking-wider mb-1">Places</h3>
          <p className="text-2xl font-semibold text-ink-900">{placeCount}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-ink-100">
          <h3 className="text-xs text-ink-500 uppercase tracking-wider mb-1">Missing Hours</h3>
          <p className="text-2xl font-semibold text-orange-600">{placesMissingHours}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-ink-100">
          <h3 className="text-xs text-ink-500 uppercase tracking-wider mb-1">Rejected</h3>
          <p className="text-2xl font-semibold text-red-600">{rejectedPlaces}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-ink-100 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-50 border-b border-ink-100 text-ink-600">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Destination</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Source Type</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {places.map((place) => (
              <tr key={place.id} className="hover:bg-ink-50/50">
                <td className="px-4 py-3 font-medium text-ink-900">{place.name}</td>
                <td className="px-4 py-3 text-ink-600">{place.destination.name}</td>
                <td className="px-4 py-3 text-ink-600 capitalize">{place.category}</td>
                <td className="px-4 py-3 text-ink-600">
                  <span className="px-2 py-1 bg-ink-100 rounded-full text-xs font-medium">
                    {place.sourceType}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink-600">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    place.dataStatus === 'VERIFIED' ? 'bg-green-100 text-green-700' :
                    place.dataStatus === 'REJECTED' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {place.dataStatus}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink-600">
                  <Link href={`/admin/places/${place.id}`} className="text-blue-600 hover:underline text-sm font-medium">
                    Review
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
