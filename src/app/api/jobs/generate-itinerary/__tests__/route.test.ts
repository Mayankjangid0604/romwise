import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { POST } from "../route";

// Mock the NextRequest
class MockNextRequest {
  headers = new Map<string, string>();
  method = "POST";
  
  constructor(public url: string, public body: unknown) {}
  
  async json() {
    return this.body;
  }
}

describe("POST /api/jobs/generate-itinerary", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("should return 401 if internal job secret is missing in headers", async () => {
    process.env.INTERNAL_JOB_SECRET = "secret123";
    
    const req = new MockNextRequest("http://localhost/api/jobs/generate-itinerary", { tripId: "123" });
    const res = await POST(req as unknown as Request);
    
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 401 if internal job secret does not match", async () => {
    process.env.INTERNAL_JOB_SECRET = "secret123";
    
    const req = new MockNextRequest("http://localhost/api/jobs/generate-itinerary", { tripId: "123" });
    req.headers.set("authorization", "Bearer wrongsecret");
    
    const res = await POST(req as unknown as Request);
    
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 400 if tripId is missing, even with correct secret", async () => {
    process.env.INTERNAL_JOB_SECRET = "secret123";
    
    const req = new MockNextRequest("http://localhost/api/jobs/generate-itinerary", {});
    req.headers.set("authorization", "Bearer secret123");
    
    const res = await POST(req as unknown as Request);
    
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Missing parameters");
  });
});
