import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import * as authModule from "@/lib/auth";
import { AIGateway } from "@/lib/ai/gateway";

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock AIGateway
vi.mock("@/lib/ai/gateway", () => ({
  AIGateway: {
    generateStructured: vi.fn(),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}));

// Mock NextRequest
class MockNextRequest {
  headers = new Map<string, string>();
  method = "POST";
  
  constructor(public url: string, public body: unknown) {}
  
  async json() {
    return this.body;
  }
}

describe("POST /api/chat/planner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
     
    vi.mocked(authModule.auth).mockResolvedValue({
      user: { id: "test-user-id" },
    } as never);
  });

  it("should return 401 if unauthorized", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(authModule.auth).mockResolvedValue(null as unknown as any);
    
    const req = new MockNextRequest("http://localhost/api/chat/planner", { messages: [] });
    const res = await POST(req as unknown as Request);
    
    expect(res.status).toBe(401);
  });

  it("should return 400 if messages is not an array", async () => {
    const req = new MockNextRequest("http://localhost/api/chat/planner", { messages: "not an array" });
    const res = await POST(req as unknown as Request);
    
    expect(res.status).toBe(400);
  });

  it("should parse and return valid AI responses", async () => {
    const validAIResponse = {
      type: "complete",
      message: "Great! I have all the details.",
      extractedData: {
        destination: "Paris",
        startDate: "2024-05-01",
        endDate: "2024-05-05",
        budgetInr: 100000,
        paceLevel: "balanced",
        maxTravelers: 2
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(AIGateway.generateStructured).mockResolvedValue({ data: validAIResponse } as unknown as any);

    const req = new MockNextRequest("http://localhost/api/chat/planner", {
      messages: [{ role: "user", content: "Let's go to Paris for 4 days next May, budget 1 lakh for 2 people" }]
    });
    
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(200);
    
    const data = await res.json();
    expect(data.type).toBe("complete");
    expect(data.extractedData.destination).toBe("Paris");
    expect(data.extractedData.budgetInr).toBe(100000);
  });

  it("should return 502 if AI response fails validation (missing required fields)", async () => {
    // Missing 'type' and 'message'
    const invalidAIResponse = {
      extractedData: {
        destination: "Paris",
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(AIGateway.generateStructured).mockResolvedValue({ data: invalidAIResponse } as unknown as any);

    const req = new MockNextRequest("http://localhost/api/chat/planner", {
      messages: [{ role: "user", content: "I want to go to Paris" }]
    });
    
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(502);
    
    const data = await res.json();
    expect(data.error).toBe("Invalid response from AI");
  });

  it("should allow partial extracted data in 'question' state", async () => {
    const validAIResponse = {
      type: "question",
      message: "Paris is great! When do you want to go?",
      extractedData: {
        destination: "Paris",
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(AIGateway.generateStructured).mockResolvedValue({ data: validAIResponse } as unknown as any);

    const req = new MockNextRequest("http://localhost/api/chat/planner", {
      messages: [{ role: "user", content: "I want to go to Paris" }]
    });
    
    const res = await POST(req as unknown as Request);
    expect(res.status).toBe(200);
    
    const data = await res.json();
    expect(data.type).toBe("question");
    expect(data.extractedData.destination).toBe("Paris");
    expect(data.extractedData.budgetInr).toBeUndefined();
  });
});
