import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../src/lib/db';
import { getCandidatePlaces } from '../src/lib/travel-knowledge';

vi.mock('../src/lib/db', () => ({
  prisma: {
    place: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    travelDestination: {
      findUnique: vi.fn(),
    }
  }
}));

// Need to mock getDestinationDescendants
vi.mock('../src/lib/destination-hierarchy', () => ({
  getDestinationDescendants: vi.fn().mockResolvedValue(['dest-1']),
}));

describe('Admin Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('excludes REJECTED and deprecated places in candidate retrieval', async () => {
    const mockFindMany = vi.mocked(prisma.place.findMany);
    mockFindMany.mockResolvedValue([]);

    await getCandidatePlaces({ destinationId: 'dest-1', allPreferences: [] });

    expect(mockFindMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        dataStatus: { notIn: ["deprecated", "REJECTED"] }
      }),
      orderBy: [{ popularityScore: 'desc' }]
    });
  });
});
