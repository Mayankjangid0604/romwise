import { vi, describe, it, expect, beforeEach, afterEach, Mock } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/auth', () => ({
  auth: vi.fn()
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    trip: {
      findUnique: vi.fn()
    }
  }
}));

// Mock playwright-core
const { mockLaunch, mockBrowser, mockContext, mockPage } = vi.hoisted(() => {
  const mockPdfBuffer = Buffer.from('mock-pdf-content');
  const mockPage = {
    goto: vi.fn().mockResolvedValue(null),
    pdf: vi.fn().mockResolvedValue(mockPdfBuffer)
  };
  const mockContext = {
    newPage: vi.fn().mockResolvedValue(mockPage),
    addCookies: vi.fn().mockResolvedValue(null)
  };
  const mockBrowser = {
    newContext: vi.fn().mockResolvedValue(mockContext),
    close: vi.fn().mockResolvedValue(null)
  };
  return {
    mockLaunch: vi.fn().mockResolvedValue(mockBrowser),
    mockBrowser,
    mockContext,
    mockPage
  };
});

vi.mock('playwright-core', () => ({
  chromium: {
    launch: mockLaunch
  }
}));

// Mock @sparticuz/chromium
vi.mock('@sparticuz/chromium', () => ({
  default: {
    args: ['--mock-args'],
    executablePath: vi.fn().mockResolvedValue('/mock/path/chromium'),
    headless: true
  }
}));

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

describe('PDF Route handler', () => {
  const mockReq = (url = 'http://localhost/api/trips/trip-123/pdf', headers = {}) => {
    return new NextRequest(new URL(url), {
      headers: new Headers(headers)
    });
  };

  beforeEach(() => {
    process.env.APP_URL = 'http://localhost:3000';
    vi.clearAllMocks();
    
    // Default mocks
    (auth as Mock).mockResolvedValue({ user: { id: 'user-1' } });
    (prisma.trip.findUnique as Mock).mockResolvedValue({
      id: 'trip-123',
      creatorId: 'user-1',
      groupMembers: []
    });
    mockLaunch.mockResolvedValue(mockBrowser);
  });

  afterEach(() => {
    delete process.env.APP_URL;
  });

  it('1. unauthenticated PDF request rejected', async () => {
    (auth as Mock).mockResolvedValue(null);
    const req = mockReq();
    const res = await GET(req, { params: Promise.resolve({ id: 'trip-123' }) });
    expect(res.status).toBe(401);
  });

  it('2. non-member rejected', async () => {
    (auth as Mock).mockResolvedValue({ user: { id: 'other-user' } });
    const req = mockReq();
    const res = await GET(req, { params: Promise.resolve({ id: 'trip-123' }) });
    expect(res.status).toBe(403);
  });

  it('3. member permitted', async () => {
    (auth as Mock).mockResolvedValue({ user: { id: 'member-1' } });
    (prisma.trip.findUnique as Mock).mockResolvedValue({
      id: 'trip-123',
      creatorId: 'user-1',
      groupMembers: [{ userId: 'member-1' }]
    });
    const req = mockReq();
    const res = await GET(req, { params: Promise.resolve({ id: 'trip-123' }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
  });

  it('4. malformed trip ID rejected', async () => {
    const req = mockReq();
    const res = await GET(req, { params: Promise.resolve({ id: 'trip-../../invalid' }) });
    expect(res.status).toBe(400);
  });

  it('5. missing trip handled', async () => {
    (prisma.trip.findUnique as Mock).mockResolvedValue(null);
    const req = mockReq();
    const res = await GET(req, { params: Promise.resolve({ id: 'trip-123' }) });
    expect(res.status).toBe(404);
  });

  it('6. Chromium launch failure handled safely with fallback', async () => {
    mockLaunch.mockRejectedValueOnce(new Error('Failed to launch browser'));
    const req = mockReq('http://localhost:3000/api/trips/trip-123/pdf');
    const res = await GET(req, { params: Promise.resolve({ id: 'trip-123' }) });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain('/trips/trip-123/print');
  });

  it('7. successful PDF returns application/pdf', async () => {
    const req = mockReq();
    const res = await GET(req, { params: Promise.resolve({ id: 'trip-123' }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="roamwise-trip-trip-123.pdf"');
  });

  it('8. APP_URL cannot be replaced by arbitrary Host header', async () => {
    const req = mockReq('http://evil-attacker.com/api/trips/trip-123/pdf');
    const res = await GET(req, { params: Promise.resolve({ id: 'trip-123' }) });
    
    // The printUrl should still use APP_URL (http://localhost:3000) not the Host header
    expect(mockPage.goto).toHaveBeenCalledWith(
      expect.stringContaining('http://localhost:3000/trips/trip-123/print'),
      expect.any(Object)
    );
  });
  
  it('9. no password/session secrets included in output/errors', async () => {
    // If it fails, the user gets a 303 redirect. The stack trace is not exposed in the response.
    mockLaunch.mockRejectedValueOnce(new Error('SECRET_XYZ'));
    const req = mockReq('http://localhost:3000/api/trips/trip-123/pdf');
    const res = await GET(req, { params: Promise.resolve({ id: 'trip-123' }) });
    const text = await res.text();
    expect(text).not.toContain('SECRET_XYZ');
    expect(res.status).toBe(303);
  });
});
