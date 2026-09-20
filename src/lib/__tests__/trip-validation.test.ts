import { describe, it, expect } from 'vitest';
import { TripInputSchema } from '../trip-validation';

describe('TripInputSchema', () => {
  it('allows ONE_DAY trips to have same start and end date', () => {
    const result = TripInputSchema.safeParse({
      title: 'Goa Trip',
      destination: 'Goa',
      startDate: '2025-01-01',
      endDate: '2025-01-01',
      budget: 1000,
      maxTravelers: 2,
      tripType: 'ONE_DAY'
    });
    expect(result.success).toBe(true);
  });

  it('rejects MULTI_DAY trips with same start and end date', () => {
    const result = TripInputSchema.safeParse({
      title: 'Goa Trip',
      destination: 'Goa',
      startDate: '2025-01-01',
      endDate: '2025-01-01',
      budget: 1000,
      maxTravelers: 2,
      tripType: 'MULTI_DAY'
    });
    expect(result.success).toBe(false);
  });
});
