import { describe, it, expect } from 'vitest';
import { getRoutingProvider } from '../index';
import { ApproximateRoutingProvider } from '../approximate';
import { GoogleRoutesProvider } from '../google-stub';

describe('Routing Architecture', () => {
  it('should default to approximate provider', () => {
    const originalEnv = process.env.ROUTING_PROVIDER;
    delete process.env.ROUTING_PROVIDER;
    
    const provider = getRoutingProvider();
    expect(provider).toBeInstanceOf(ApproximateRoutingProvider);
    expect(provider.name).toBe('approximate');
    
    process.env.ROUTING_PROVIDER = originalEnv;
  });

  it('approximate provider should calculate straight line routes', async () => {
    const provider = new ApproximateRoutingProvider();
    
    // Delhi to Agra (approx 180km straight line)
    const result = await provider.getRoute({
      origin: { lat: 28.6139, lng: 77.2090 },
      destination: { lat: 27.1767, lng: 78.0081 }
    });
    
    expect(result.distanceKm).toBeGreaterThan(150);
    expect(result.distanceKm).toBeLessThan(200);
    expect(result.legs).toHaveLength(1);
    expect(result.legs[0].distanceKm).toBe(result.distanceKm);
  });

  it('google stub should not be available without key and config', async () => {
    const provider = new GoogleRoutesProvider();
    
    const originalKey = process.env.GOOGLE_MAPS_API_KEY;
    const originalProvider = process.env.ROUTING_PROVIDER;
    
    delete process.env.GOOGLE_MAPS_API_KEY;
    process.env.ROUTING_PROVIDER = 'google';
    
    expect(provider.isAvailable()).toBe(false);
    await expect(provider.getRoute({
      origin: { lat: 0, lng: 0 },
      destination: { lat: 0, lng: 0 }
    })).rejects.toThrow();

    process.env.GOOGLE_MAPS_API_KEY = originalKey;
    process.env.ROUTING_PROVIDER = originalProvider;
  });
});
