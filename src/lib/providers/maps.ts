export interface GeoCoordinates {
  lat: number;
  lng: number;
}

export interface GeocodeResult extends GeoCoordinates {
  formattedAddress: string;
}

export interface MapProvider {
  geocode(address: string): Promise<GeocodeResult | null>;
  calculateDistance(from: GeoCoordinates, to: GeoCoordinates): number;
}

export class MockMapProvider implements MapProvider {
  async geocode(_address: string): Promise<GeocodeResult | null> {
    // ponytail: stub — geocode is unused; if needed, query TravelDestination table by name
    return null;
  }

  calculateDistance(from: GeoCoordinates, to: GeoCoordinates): number {
    // Haversine formula
    const R = 6371; // km
    const dLat = (to.lat - from.lat) * Math.PI / 180;
    const dLng = (to.lng - from.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}

export const mapProvider = new MockMapProvider();
