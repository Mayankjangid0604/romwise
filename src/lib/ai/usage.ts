import { prisma } from "@/lib/db";
import { AIUsageMetrics, AIRequestContext, AIProviderName } from "./types";
import { estimateCost } from "./router";

export interface LogUsageParams {
  context: AIRequestContext;
  provider: AIProviderName;
  model: string;
  usage: AIUsageMetrics;
  latencyMs: number;
  status: "success" | "error" | "timeout";
  errorType?: string;
  fallbackUsed?: boolean;
}

export async function logAIUsage(params: LogUsageParams): Promise<void> {
  try {
    const estimatedCost = estimateCost(params.model, params.usage.inputTokens, params.usage.outputTokens);

    await prisma.aIUsage.create({
      data: {
        userId: params.context.userId || null,
        tripId: params.context.tripId || null,
        task: params.context.task,
        requestId: params.context.requestId || null,
        provider: params.provider,
        model: params.model,
        inputTokens: params.usage.inputTokens,
        outputTokens: params.usage.outputTokens,
        totalTokens: params.usage.totalTokens,
        estimatedCost: estimatedCost,
        currency: params.usage.currency,
        latencyMs: params.latencyMs,
        status: params.status,
        errorType: params.errorType,
        fallbackUsed: params.fallbackUsed || false,
      },
    });
  } catch (error) {
    // We do not want usage logging failure to break the main application flow
    console.error("[AI Usage Tracking Failed]", error);
  }
}
