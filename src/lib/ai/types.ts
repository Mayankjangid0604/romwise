export type AITask =
  | "conversation"
  | "preference_extraction"
  | "destination_discovery"
  | "destination_details"
  | "trip_planning"
  | "replanning"
  | "group_alignment"
  | "item_alignment"
  | "packing"
  | "copilot";

export type AIProviderName = "gemini" | "local" | "mock";

export interface AIUsageMetrics {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCost: number | null;
  currency: string;
}

export interface AIResult<T> {
  data: T;
  provider: AIProviderName;
  model: string;
  usage: AIUsageMetrics;
  latencyMs: number;
  requestId: string | null;
  fallbackUsed: boolean;
}

export interface AITextResult {
  text: string;
  provider: AIProviderName;
  model: string;
  usage: AIUsageMetrics;
  latencyMs: number;
  requestId: string | null;
  fallbackUsed: boolean;
}

export interface AIRequestContext {
  userId?: string;
  tripId?: string;
  task: AITask;
  requestId?: string;
}

export interface AIRequest<T = unknown> {
  prompt: string;
  systemInstruction?: string;
  context: AIRequestContext;
  schema?: unknown; // JSON schema for structured output
  maxTokens?: number;
  temperature?: number;
}

export interface AIProvider {
  name: AIProviderName;
  generateStructured<T>(req: AIRequest<T>, modelOverride?: string): Promise<AIResult<T>>;
  generateText(req: AIRequest<unknown>, modelOverride?: string): Promise<AITextResult>;
}

export class AIGatewayError extends Error {
  public code: string;
  public provider?: string;
  public isTransient: boolean;

  constructor(message: string, code: string, isTransient: boolean = false, provider?: string) {
    super(message);
    this.name = "AIGatewayError";
    this.code = code;
    this.isTransient = isTransient;
    this.provider = provider;
  }
}
