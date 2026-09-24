/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeCopilotIntent } from './copilot';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AIGateway } from '@/lib/ai/gateway';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    groupMember: { findFirst: vi.fn() },
    trip: { findUnique: vi.fn() },
    itineraryItem: { delete: vi.fn(), create: vi.fn(), update: vi.fn() },
    travelDestination: { findFirst: vi.fn() },
    place: { findUnique: vi.fn() },
  }
}));

vi.mock('@/lib/ai/gateway', () => ({
  AIGateway: { generateStructured: vi.fn() },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Copilot Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an outsider', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'outsider-id' } } as any);
    vi.mocked(prisma.groupMember.findFirst).mockResolvedValue(null);

    const result = await executeCopilotIntent('trip-1', 'Remove the cafe');
    expect(result.success).toBe(false);
    expect((result as any).error).toContain('Unauthorized: Not a member');
  });

  it('rejects a viewer', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'viewer-id' } } as any);
    vi.mocked(prisma.groupMember.findFirst).mockResolvedValue({ role: 'viewer' } as any);

    const result = await executeCopilotIntent('trip-1', 'Remove the cafe');
    expect(result.success).toBe(false);
    expect((result as any).error).toContain('Unauthorized: Viewers cannot modify');
  });

  it('allows a creator to remove an item', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'creator-id' } } as any);
    vi.mocked(prisma.groupMember.findFirst).mockResolvedValue({ role: 'admin' } as any);
    vi.mocked(prisma.trip.findUnique).mockResolvedValue({
      id: 'trip-1',
      destination: 'Paris',
      itineraryDays: [
        { dayNumber: 1, id: 'day-1', items: [{ id: 'item-1', title: 'Cafe Louvre' }] }
      ]
    } as any);

    vi.mocked(AIGateway.generateStructured).mockResolvedValue({
      data: {
        message: "Removed it.",
        intent: {
          action: "REMOVE_ITEM",
          targetItemTitle: "Cafe Louvre"
        }
      }
    } as any);

    const result = await executeCopilotIntent('trip-1', 'Remove Cafe Louvre');
    expect(result.success).toBe(true);
    expect(prisma.itineraryItem.delete).toHaveBeenCalledWith({ where: { id: 'item-1' } });
  });

  it('rejects an invented place ID for ADD_PLACE (if placeId were returned by AI)', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'creator-id' } } as any);
    vi.mocked(prisma.groupMember.findFirst).mockResolvedValue({ role: 'admin' } as any);
    vi.mocked(prisma.trip.findUnique).mockResolvedValue({
      id: 'trip-1',
      destination: 'Paris',
      itineraryDays: [{ dayNumber: 1, id: 'day-1', items: [] }]
    } as any);

    vi.mocked(AIGateway.generateStructured).mockResolvedValue({
      data: {
        message: "Added fake place.",
        intent: {
          action: "ADD_PLACE",
          targetDayNumber: 1,
          placeId: "fake-place-that-does-not-exist" // The backend should ignore AI's ID
        }
      }
    } as any);

    // AI returning an invented placeId should be ignored or explicitly queried/rejected.
    // Our refactor will ensure it either fetches via a safe search keyword or creates a placeholder, but NEVER uses the AI's raw placeId.
    vi.mocked(prisma.place.findUnique).mockResolvedValue(null);

    const result = await executeCopilotIntent('trip-1', 'Add a fake place');
    expect(result.success).toBe(true);
    // Should create a placeholder (placeId: null), NOT use the fake place ID.
    expect(prisma.itineraryItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ placeId: "fake-place-that-does-not-exist" })
      })
    );
  });

  it('rejects cross-trip items for REMOVE_ITEM', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'creator-id' } } as any);
    vi.mocked(prisma.groupMember.findFirst).mockResolvedValue({ role: 'admin' } as any);
    
    // The trip does NOT contain the item the AI wants to remove
    vi.mocked(prisma.trip.findUnique).mockResolvedValue({
      id: 'trip-1',
      destination: 'Paris',
      itineraryDays: [
        { dayNumber: 1, id: 'day-1', items: [{ id: 'item-1', title: 'Cafe Louvre' }] }
      ]
    } as any);

    vi.mocked(AIGateway.generateStructured).mockResolvedValue({
      data: {
        message: "Removed it.",
        intent: {
          action: "REMOVE_ITEM",
          targetItemTitle: "Eiffel Tower" // Not in trip-1
        }
      }
    } as any);

    const result = await executeCopilotIntent('trip-1', 'Remove Eiffel Tower');
    expect(result.success).toBe(true);
    expect(prisma.itineraryItem.delete).not.toHaveBeenCalled(); // Rejected/no-op
  });

  it('handles AI unavailability safely', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'creator-id' } } as any);
    vi.mocked(prisma.groupMember.findFirst).mockResolvedValue({ role: 'admin' } as any);
    vi.mocked(prisma.trip.findUnique).mockResolvedValue({
      id: 'trip-1',
      itineraryDays: []
    } as any);

    vi.mocked(AIGateway.generateStructured).mockRejectedValue(new Error("AI Gateway Offline"));

    const result = await executeCopilotIntent('trip-1', 'Do something');
    expect(result.success).toBe(false);
    expect((result as any).error).toContain('Failed to process AI request');
  });
});
