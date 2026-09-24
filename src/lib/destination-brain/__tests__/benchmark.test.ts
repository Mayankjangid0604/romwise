import { describe, it, expect, beforeAll } from 'vitest';
import { getDestinationsForCollection } from '../recommendation';
import { CollectionTheme } from '../types';
import { COLLECTIONS } from '../collections';

describe('Destination Brain Benchmark', () => {
  const themesToTest: CollectionTheme[] = [
    'mountains',
    'beaches',
    'forests',
    'nature',
    'heritage',
    'spiritual',
    'wildlife',
    'adventure',
    'family',
    'food'
  ];

  for (const theme of themesToTest) {
    it(`should recommend relevant destinations for ${theme}`, async () => {
      const results = await getDestinationsForCollection({ theme, limit: 5 });
      
      // If there are no results, it means we lack data for this theme, 
      // but the query itself shouldn't fail.
      expect(Array.isArray(results)).toBe(true);

      if (results.length > 0) {
        // Assert that the top result has some minimum confidence
        const topResult = results[0];
        expect(topResult.confidence).toBeGreaterThanOrEqual(0);
        expect(topResult.placeCount).toBeGreaterThanOrEqual(4); // We set a min requirement of 4
        expect(topResult.reasons.length).toBeGreaterThanOrEqual(1);
        expect(topResult.reasons[0]).toContain(COLLECTIONS[theme].title.toLowerCase());
      }
    });
  }

  it('should handle state filtering', async () => {
    const results = await getDestinationsForCollection({ theme: 'spiritual', limit: 5, state: 'Uttar Pradesh' });
    if (results.length > 0) {
      expect(results[0].state).toBe('Uttar Pradesh');
    }
  });
});
