export interface ImageResult {
  url: string;
  thumbnailUrl?: string;
  source: string; // e.g., "Unsplash"
  sourceUrl?: string;
  authorName?: string;
  authorUrl?: string;
  license?: string;
  width?: number;
  height?: number;
}

export interface ImageProvider {
  searchDestinationImage(destinationName: string): Promise<ImageResult | null>;
  searchPlaceImage(placeName: string, destinationName: string): Promise<ImageResult | null>;
}

const CURATED_DESTINATIONS: Record<string, ImageResult> = {
  "paris": {
    url: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200&q=80",
    thumbnailUrl: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400&q=80",
    authorName: "Chris Karidis",
    authorUrl: "https://unsplash.com/@chriskaridis",
    source: "Unsplash",
    sourceUrl: "https://unsplash.com/photos/e4j5-80_vTQ",
    license: "Unsplash License",
  },
  "tokyo": {
    url: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1200&q=80",
    thumbnailUrl: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&q=80",
    authorName: "Jezael Melgoza",
    authorUrl: "https://unsplash.com/@jezael",
    source: "Unsplash",
    sourceUrl: "https://unsplash.com/photos/alY6_Op2BgE",
    license: "Unsplash License",
  },
  "new york": {
    url: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1200&q=80",
    thumbnailUrl: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=400&q=80",
    authorName: "Oliver Niblett",
    authorUrl: "https://unsplash.com/@oliverniblett",
    source: "Unsplash",
    sourceUrl: "https://unsplash.com/photos/wh-7GeXxItI",
    license: "Unsplash License",
  },
  "london": {
    url: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1200&q=80",
    thumbnailUrl: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=400&q=80",
    authorName: "Sabrina Mazzeo",
    authorUrl: "https://unsplash.com/@sabrinamazzeo",
    source: "Unsplash",
    sourceUrl: "https://unsplash.com/photos/g29arbbvPjo",
    license: "Unsplash License",
  },
  "bali": {
    url: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1200&q=80",
    thumbnailUrl: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&q=80",
    authorName: "Geio Tischler",
    authorUrl: "https://unsplash.com/@geiot",
    source: "Unsplash",
    sourceUrl: "https://unsplash.com/photos/Gpe_H8g1YDQ",
    license: "Unsplash License",
  },
};

const DEFAULT_IMAGE: ImageResult = {
  url: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1200&q=80",
  thumbnailUrl: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&q=80",
  authorName: "Ian Dooley",
  authorUrl: "https://unsplash.com/@sadswim",
  source: "Unsplash",
  sourceUrl: "https://unsplash.com/photos/DuBNA1QMpPA",
  license: "Unsplash License",
};

export class CuratedImageProvider implements ImageProvider {
  async searchDestinationImage(destinationName: string): Promise<ImageResult | null> {
    const key = destinationName.toLowerCase();
    for (const curatedKey in CURATED_DESTINATIONS) {
      if (key.includes(curatedKey)) {
        return CURATED_DESTINATIONS[curatedKey];
      }
    }
    return DEFAULT_IMAGE;
  }

  async searchPlaceImage(placeName: string, destinationName: string): Promise<ImageResult | null> {
    return {
      url: "https://images.unsplash.com/photo-1517056627581-2c9748b8c2c5?w=800&q=80",
      thumbnailUrl: "https://images.unsplash.com/photo-1517056627581-2c9748b8c2c5?w=400&q=80",
      authorName: "John Doe",
      authorUrl: "https://unsplash.com",
      source: "Unsplash",
      sourceUrl: "https://unsplash.com",
      license: "License not recorded",
    };
  }
}

export const imageProvider = new CuratedImageProvider();
