import { AIProvider, AIRequest, AIResult, AITextResult, AIGatewayError, AITask } from "./types";
import { getModelForTask } from "./router";
import { GeminiProvider } from "./providers/gemini";
import { logAIUsage } from "./usage";

const providers: Record<string, AIProvider> = {
  gemini: new GeminiProvider(),
};

interface GatewayOptions {
  timeoutMs?: number;
  maxRetries?: number;
}

const DEFAULT_TIMEOUT_MS = 30000;
const TRIP_BRAIN_TIMEOUT_MS = 60000;
const DEFAULT_MAX_RETRIES = 1;

function getTimeoutForTask(task: AITask): number {
  if (task === "trip_planning" || task === "replanning") return TRIP_BRAIN_TIMEOUT_MS;
  if (task === "destination_discovery" || task === "destination_details") return TRIP_BRAIN_TIMEOUT_MS;
  return DEFAULT_TIMEOUT_MS;
}

export class AIGateway {
  private static async executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new AIGatewayError(`Request timed out after ${timeoutMs}ms`, "AI_TIMEOUT", true));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId!);
    }
  }

  static async generateStructured<T>(req: AIRequest<T>, opts?: GatewayOptions): Promise<AIResult<T>> {
    const { provider: providerName, model } = getModelForTask(req.context.task);
    const provider = providers[providerName];

    if (!provider) {
      throw new AIGatewayError(`Provider ${providerName} not found`, "AI_PROVIDER_ERROR", false);
    }

    const timeoutMs = opts?.timeoutMs || getTimeoutForTask(req.context.task);
    const maxRetries = opts?.maxRetries ?? DEFAULT_MAX_RETRIES;
    let attempt = 0;
    let lastError: Error | unknown;

    while (attempt <= maxRetries) {
      try {
        const result = await this.executeWithTimeout(
          provider.generateStructured(req, model),
          timeoutMs
        );

        // Async log usage without blocking
        void logAIUsage({
          context: req.context,
          provider: provider.name,
          model,
          usage: result.usage,
          latencyMs: result.latencyMs,
          status: "success",
        });

        return result;
      } catch (error) {
        lastError = error;
        attempt++;

        const isTransient = error instanceof AIGatewayError ? error.isTransient : true;
        
        if (!isTransient || attempt > maxRetries) {
          // Log failure
          void logAIUsage({
            context: req.context,
            provider: provider.name,
            model,
            usage: { inputTokens: null, outputTokens: null, totalTokens: null, estimatedCost: null, currency: "USD" },
            latencyMs: 0,
            status: error instanceof AIGatewayError && error.code === "AI_TIMEOUT" ? "timeout" : "error",
            errorType: error instanceof AIGatewayError ? error.code : "UNKNOWN_ERROR",
          });
          
          if (error instanceof AIGatewayError) throw error;
          throw new AIGatewayError((error as Error).message, "AI_PROVIDER_ERROR", true, providerName);
        }
        
        // Wait before retry
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
    }

    throw lastError; // Should never be reached
  }

  static async generateText(req: AIRequest<unknown>, opts?: GatewayOptions): Promise<AITextResult> {
    const { provider: providerName, model } = getModelForTask(req.context.task);
    const provider = providers[providerName];

    if (!provider) {
      throw new AIGatewayError(`Provider ${providerName} not found`, "AI_PROVIDER_ERROR", false);
    }

    const timeoutMs = opts?.timeoutMs || getTimeoutForTask(req.context.task);
    const maxRetries = opts?.maxRetries ?? DEFAULT_MAX_RETRIES;
    let attempt = 0;
    let lastError: Error | unknown;

    while (attempt <= maxRetries) {
      try {
        const result = await this.executeWithTimeout(
          provider.generateText(req, model),
          timeoutMs
        );

        void logAIUsage({
          context: req.context,
          provider: provider.name,
          model,
          usage: result.usage,
          latencyMs: result.latencyMs,
          status: "success",
        });

        return result;
      } catch (error) {
        lastError = error;
        attempt++;

        const isTransient = error instanceof AIGatewayError ? error.isTransient : true;
        
        if (!isTransient || attempt > maxRetries) {
          void logAIUsage({
            context: req.context,
            provider: provider.name,
            model,
            usage: { inputTokens: null, outputTokens: null, totalTokens: null, estimatedCost: null, currency: "USD" },
            latencyMs: 0,
            status: error instanceof AIGatewayError && error.code === "AI_TIMEOUT" ? "timeout" : "error",
            errorType: error instanceof AIGatewayError ? error.code : "UNKNOWN_ERROR",
          });

          if (error instanceof AIGatewayError) throw error;
          throw new AIGatewayError((error as Error).message, "AI_PROVIDER_ERROR", true, providerName);
        }
        
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
    }

    throw lastError;
  }
}
