export interface ImageResult {
  url: string;
  authorName: string;
  authorUrl: string;
}

export interface ImageProvider {
  searchDestinationImage(destinationName: string): Promise<ImageResult | null>;
  searchPlaceImage(placeName: string, destinationName: string): Promise<ImageResult | null>;
}

export class MockImageProvider implements ImageProvider {
  async searchDestinationImage(destinationName: string): Promise<ImageResult | null> {
    return {
      url: `https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1200&q=80`,
      authorName: "Ian Dooley",
      authorUrl: "https://unsplash.com/@sadswim",
    };
  }

  async searchPlaceImage(placeName: string, destinationName: string): Promise<ImageResult | null> {
    return {
      url: `https://images.unsplash.com/photo-1517056627581-2c9748b8c2c5?w=800&q=80`,
      authorName: "John Doe",
      authorUrl: "https://unsplash.com",
    };
  }
}

export const imageProvider = new MockImageProvider();
