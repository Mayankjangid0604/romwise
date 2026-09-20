/**
 * Image Service
 * 
 * Provides a boundary for fetching, processing, and associating images
 * with Destinations and Places.
 * 
 * Future implementation will integrate with external providers (e.g. Unsplash, Google Places API)
 * and manage caching/persistence in the `Image` Prisma model.
 */

export interface TravelImage {
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
  credit: string | null;
}

export class ImageService {
  static async getImagesForPlace(placeId: string): Promise<TravelImage[]> {
    // Stub: Currently returns empty array. 
    // Phase D will query the DB or external providers.
    return [];
  }

  static async getImagesForDestination(destinationId: string): Promise<TravelImage[]> {
    // Stub
    return [];
  }
}
