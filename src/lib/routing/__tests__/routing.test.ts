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

  it('approximate provider should calculate approximate routes', async () => {
    const provider = new ApproximateRoutingProvider();
    
    // Delhi to Agra (approx 180km straight line, ~234km with road penalty)
    const result = await provider.getRoute({
      origin: { lat: 28.6139, lng: 77.2090 },
      destination: { lat: 27.1767, lng: 78.0081 }
    });
    
    // Straight-line ~180km × 1.3 road penalty = ~234km
    expect(result.distanceKm).toBeGreaterThan(200);
    expect(result.distanceKm).toBeLessThan(280);
    expect(result.legs).toHaveLength(1);
    expect(result.legs[0].distanceKm).toBe(result.distanceKm);
    expect(result.provider).toBe('approximate');
    // Duration should be reasonable for ~234km at ~55km/h
    expect(result.durationMinutes).toBeGreaterThan(200);
    expect(result.durationMinutes).toBeLessThan(400);
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
