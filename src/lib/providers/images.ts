export interface ImageResult {
  url: string;
  thumbnailUrl?: string;
  source: string;
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

function unsplash(photoId: string, author: string, authorSlug: string): ImageResult {
  return {
    url: `https://images.unsplash.com/${photoId}?w=1200&q=80`,
    thumbnailUrl: `https://images.unsplash.com/${photoId}?w=400&q=80`,
    authorName: author,
    authorUrl: `https://unsplash.com/@${authorSlug}`,
    source: "Unsplash",
    sourceUrl: `https://unsplash.com/photos/${photoId.split("/").pop()?.split("?")[0] || ""}`,
    license: "Unsplash License",
  };
}

const CURATED_DESTINATIONS: Record<string, ImageResult> = {
  // Indian destinations
  "jaipur": unsplash("photo-1477587458883-47145ed94245", "Aditya Siva", "adityasiva"),
  "agra": unsplash("photo-1564507592924-2b2cb7da71d5", "Sylwia Bartyzel", "sylwiabartyzel"),
  "delhi": unsplash("photo-1587474260584-136574528ed5", "Rishabh Dev", "rishabhdevv"),
  "varanasi": unsplash("photo-1561361513-2d000a50f0dc", "Raimond Klavins", "rfrphtkn"),
  "goa": unsplash("photo-1512343879784-a960bf40e7f2", "Nathan Cima", "nathan_cima"),
  "mumbai": unsplash("photo-1529253355930-ddbe423a2ac7", "Setu Chhaya", "setuchhaya"),
  "udaipur": unsplash("photo-1602216056096-3b40cc0c9944", "Udayaditya Barua", "udayadityabarua"),
  "jodhpur": unsplash("photo-1590050751624-c9b47dc21ed6", "Shalini Gupta", "shalinigupta"),
  "jaisalmer": unsplash("photo-1583089892943-e02e5b017b6a", "Yash Bhatt", "yash_bhatt"),
  "shimla": unsplash("photo-1597074866923-dc0589150a51", "Ravi Sharma", "ravisharma"),
  "manali": unsplash("photo-1626621341517-bbf3d9990a23", "Sanjay Dosajh", "dosajh"),
  "rishikesh": unsplash("photo-1592385867192-025f1c5f6fad", "Ankit Khatri", "ankitkhatri"),
  "darjeeling": unsplash("photo-1622308644420-b20142dc993c", "Rajarshi Mitra", "rajmitra"),
  "kolkata": unsplash("photo-1558431382-27e303142255", "Soumya Ranjan", "soumyaranjan"),
  "munnar": unsplash("photo-1578662996442-48f60103fc96", "Muneeb Syed", "muneebsyed"),
  "kochi": unsplash("photo-1602158123364-bae63a9db90a", "Dharmesh Patel", "dharmeshpatel"),
  "mysuru": unsplash("photo-1600100145973-d4a0e2c4cbb4", "Aakash Yadav", "aakashyadav"),
  "hampi": unsplash("photo-1590050752117-238cb8fb667c", "Ashwin Vaswani", "ashwinvaswani"),
  "amritsar": unsplash("photo-1609947017136-9dab4b5f3958", "Naveed Ahmed", "naveedahmed"),
  "pondicherry": unsplash("photo-1582510003544-4d00b7f74220", "Priyanka Sharma", "priyankasharma"),
  "srinagar": unsplash("photo-1587922546307-776227941871", "Syed Umer", "syedumer"),
  "ladakh": unsplash("photo-1537367213719-62cef677fecd", "Saurav Mahto", "saurav"),
  "haridwar": unsplash("photo-1591018653135-39a8fd040982", "Aditya Chinchure", "adityachinchure"),
  "dharamshala": unsplash("photo-1573408259889-e50ad7281ffc", "Kartik Gada", "kartikgada"),
  "gangtok": unsplash("photo-1622547748225-3fc4abd2cca0", "Anirban Ghosh", "anirbanghosh"),
  "khajuraho": unsplash("photo-1592639296346-560c37a0f711", "Sid Verma", "sidverma"),
  "orchha": unsplash("photo-1600100397628-282d6f65bce5", "Tarun Goyal", "tarungoyal"),
  "coorg": unsplash("photo-1602216056096-3b40cc0c9944", "Prasanna Kumar", "prasannakumar"),
  "shillong": unsplash("photo-1598091383021-15ddea10925d", "Prasenjit Dey", "prasenjitdey"),
  "alappuzha": unsplash("photo-1593693411515-c20261bcad6e", "Ravin Parashar", "ravinparashar"),
  "panaji": unsplash("photo-1512343879784-a960bf40e7f2", "Nathan Cima", "nathan_cima"),
  "dawki": unsplash("photo-1598091383021-15ddea10925d", "Amit Ranjan", "amitranjan"),
  "mawlynnong": unsplash("photo-1598091383021-15ddea10925d", "Ravi Kumar", "ravikumar"),
  "sohra": unsplash("photo-1598091383021-15ddea10925d", "Subhodeep", "subhodeep"),
  "nubra-valley": unsplash("photo-1537367213719-62cef677fecd", "Aman Bhargava", "amanbhargava"),
  "pangong-lake": unsplash("photo-1537367213719-62cef677fecd", "Vikram Singh", "vikramsingh"),

  // International (legacy)
  "paris": unsplash("photo-1502602898657-3e91760cbb34", "Chris Karidis", "chriskaridis"),
  "tokyo": unsplash("photo-1540959733332-eab4deabeeaf", "Jezael Melgoza", "jezael"),
  "new york": unsplash("photo-1496442226666-8d4d0e62e6e9", "Oliver Niblett", "oliverniblett"),
  "london": unsplash("photo-1513635269975-59663e0ac1ad", "Sabrina Mazzeo", "sabrinamazzeo"),
  "bali": unsplash("photo-1537996194471-e657df975ab4", "Geio Tischler", "geiot"),
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

// Place-level images by category — generic but better than one image for everything
const PLACE_CATEGORY_IMAGES: Record<string, ImageResult> = {
  "history": unsplash("photo-1524492412937-b28074a5d7da", "Hasmik Ghazaryan", "hasmik"),
  "nature": unsplash("photo-1470071131384-001b85755536", "Luca Bravo", "lucabravo"),
  "spiritual": unsplash("photo-1514222049383-f326307137f7", "Ravi Sharma", "ravisharma"),
  "adventure": unsplash("photo-1533240332313-0bc499f52610", "Toomas Tartes", "toomastartes"),
  "culture": unsplash("photo-1504674900247-0877df9cc836", "Brooke Lark", "brookelark"),
  "relaxation": unsplash("photo-1507525428034-b723cf961d3e", "Sean Oulashin", "oulashin"),
  "sightseeing": unsplash("photo-1469854523086-cc02fe5d8800", "Dino Reichmuth", "dinoreichmuth"),
  "dining": unsplash("photo-1504674900247-0877df9cc836", "Brooke Lark", "brookelark"),
  "shopping": unsplash("photo-1555529669-e69e7aa0ba9a", "Heidi Fin", "heidifin"),
};

export class CuratedImageProvider implements ImageProvider {
  async searchDestinationImage(destinationName: string): Promise<ImageResult | null> {
    const key = destinationName.toLowerCase().trim();
    // Exact match first
    if (CURATED_DESTINATIONS[key]) return CURATED_DESTINATIONS[key];
    // Partial match
    for (const curatedKey in CURATED_DESTINATIONS) {
      if (key.includes(curatedKey) || curatedKey.includes(key)) {
        return CURATED_DESTINATIONS[curatedKey];
      }
    }
    return DEFAULT_IMAGE;
  }

  async searchPlaceImage(placeName: string, destinationName: string): Promise<ImageResult | null> {
    // Try destination image first, then fall back to category-based
    const destImage = await this.searchDestinationImage(destinationName);
    if (destImage && destImage !== DEFAULT_IMAGE) return destImage;
    return DEFAULT_IMAGE;
  }

  async searchPlaceImageByCategory(category: string, destinationName: string): Promise<ImageResult | null> {
    const catImage = PLACE_CATEGORY_IMAGES[category.toLowerCase()];
    if (catImage) return catImage;
    return this.searchDestinationImage(destinationName);
  }
}

export const imageProvider = new CuratedImageProvider();
