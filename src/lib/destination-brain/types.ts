export type CollectionTheme =
  | "mountains"
  | "beaches"
  | "forests"
  | "nature"
  | "heritage"
  | "spiritual"
  | "wildlife"
  | "adventure"
  | "romantic"
  | "family"
  | "food"
  | "photography"
  | "weekend"
  | "relaxing"
  | "backpacking";

export interface DestinationProfile {
  destinationId: string;
  name: string;
  state: string;
  
  // Basic facts
  placeCount: number;
  stayCount: number;
  imageCount: number;
  
  // Theme matches (number of places matching criteria)
  historyScore: number;
  cultureScore: number;
  natureScore: number;
  mountainScore: number;
  beachScore: number;
  forestScore: number;
  spiritualScore: number;
  foodScore: number;
  familyScore: number;
  adventureScore: number;
  romanticScore: number;
  relaxationScore: number;
  photographyScore: number;
  wildlifeScore: number;
  
  // Data Readiness
  dataQualityScore: number;
  generationReadiness: "BASIC" | "GOOD_COVERAGE" | "STRONG_COVERAGE" | "NONE";
}

export interface RecommendedDestination {
  id: string;
  name: string;
  state: string;
  imageUrl?: string;
  matchScore: number;
  prominenceScore?: number;
  tier?: 'major' | 'strong' | 'hidden';
  confidence: number;
  reasons: string[];
  placeCount: number;
  stayCount: number;
  generationReadiness: "BASIC" | "GOOD_COVERAGE" | "STRONG_COVERAGE" | "NONE";
}

export interface CollectionRecommendationRequest {
  theme: CollectionTheme;
  limit?: number;
  state?: string;
  minDurationDays?: number;
}
