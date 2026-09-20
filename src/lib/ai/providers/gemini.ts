import { GoogleGenAI } from "@google/genai";
import { AIProvider, AIProviderName, AIRequest, AIResult, AITextResult, AIGatewayError } from "../types";

const clients: Map<string, GoogleGenAI> = new Map();

// Track rate-limited keys with cooldown timestamps
const rateLimitedKeys: Map<string, number> = new Map();
const RATE_LIMIT_COOLDOWN_MS = 60_000; // 1 minute cooldown

function getApiKeys(): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();

  // Collect all GEMINI_API_KEY* env vars
  const primary = process.env.GEMINI_API_KEY;
  const key2 = process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY_BACKUP;
  const key3 = process.env.GEMINI_API_KEY_3;
  const key4 = process.env.GEMINI_API_KEY_4;

  for (const k of [primary, key2, key3, key4]) {
    if (k && k.trim() && !seen.has(k)) {
      keys.push(k);
      seen.add(k);
    }
  }

  if (keys.length === 0) {
    throw new AIGatewayError("No GEMINI_API_KEY environment variables set", "AI_CONFIG_ERROR", false, "gemini");
  }
  return keys;
}

function getAvailableKeys(): string[] {
  const now = Date.now();
  const allKeys = getApiKeys();
  const available = allKeys.filter(key => {
    const cooldownUntil = rateLimitedKeys.get(key);
    if (cooldownUntil && now < cooldownUntil) return false;
    if (cooldownUntil) rateLimitedKeys.delete(key);
    return true;
  });
  // If ALL keys are cooling down, return all anyway (they may have recovered)
  return available.length > 0 ? available : allKeys;
}

function markKeyRateLimited(key: string) {
  rateLimitedKeys.set(key, Date.now() + RATE_LIMIT_COOLDOWN_MS);
  console.warn(`[Gemini] Key ...${key.slice(-6)} rate-limited, cooling down for 60s`);
}

function getClient(apiKey: string): GoogleGenAI {
  let client = clients.get(apiKey);
  if (!client) {
    client = new GoogleGenAI({ apiKey });
    clients.set(apiKey, client);
  }
  return client;
}

function isRateLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("429") || msg.includes("quota") || msg.includes("rate limit") ||
         msg.includes("RESOURCE_EXHAUSTED") || msg.includes("overloaded");
}

function isRetryableError(error: unknown): boolean {
  return isRateLimitError(error) ||
         (() => {
           const msg = error instanceof Error ? error.message : String(error);
           return msg.includes("503") || msg.includes("500");
         })();
}

function mapError(error: unknown): AIGatewayError {
  const msg = error instanceof Error ? error.message : String(error);
  if (isRateLimitError(error)) {
    return new AIGatewayError("All API keys rate limited. Please wait a minute.", "AI_RATE_LIMITED", true, "gemini");
  }
  if (msg.includes("API_KEY") || msg.includes("403")) {
    return new AIGatewayError("Authentication failed", "AI_AUTH_ERROR", false, "gemini");
  }
  if (msg.includes("JSON") || msg.includes("schema")) {
    return new AIGatewayError("Invalid output format", "AI_INVALID_OUTPUT", false, "gemini");
  }
  return new AIGatewayError(msg, "AI_PROVIDER_ERROR", true, "gemini");
}

export class GeminiProvider implements AIProvider {
  name: AIProviderName = "gemini";

  async generateStructured<T>(req: AIRequest<T>, modelOverride: string): Promise<AIResult<T>> {
    const keys = getAvailableKeys();
    let lastError: unknown;

    for (let i = 0; i < keys.length; i++) {
      const startTime = Date.now();
      try {
        const client = getClient(keys[i]);
        const response = await client.models.generateContent({
          model: modelOverride,
          contents: req.prompt,
          config: {
            systemInstruction: req.systemInstruction,
            responseMimeType: "application/json",
            responseSchema: req.schema,
            temperature: req.temperature,
            maxOutputTokens: req.maxTokens,
          },
        });

        const latencyMs = Date.now() - startTime;
        const text = response.text || "";
        if (!text) {
          throw new AIGatewayError("Empty response from provider", "AI_PROVIDER_ERROR", true, this.name);
        }

        let parsed: T;
        try {
          parsed = JSON.parse(text) as T;
        } catch {
          throw new AIGatewayError("Failed to parse JSON response", "AI_INVALID_OUTPUT", false, this.name);
        }

        return {
          data: parsed,
          provider: this.name,
          model: modelOverride,
          usage: {
            inputTokens: response.usageMetadata?.promptTokenCount ?? null,
            outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
            totalTokens: response.usageMetadata?.totalTokenCount ?? null,
            estimatedCost: null,
            currency: "USD"
          },
          latencyMs,
          requestId: null,
          fallbackUsed: i > 0,
        };
      } catch (error) {
        lastError = error;
        const errMsg = error instanceof Error ? error.message : String(error);
        console.warn(`[Gemini] Key ${i + 1}/${keys.length} failed: ${errMsg.slice(0, 100)}`);

        if (isRateLimitError(error)) markKeyRateLimited(keys[i]);
        if (error instanceof AIGatewayError && !error.isTransient) throw error;
        if (isRetryableError(error) && i < keys.length - 1) continue;
        if (error instanceof AIGatewayError) throw error;
        throw mapError(error);
      }
    }
    throw mapError(lastError);
  }

  async generateText(req: AIRequest<unknown>, modelOverride: string): Promise<AITextResult> {
    const keys = getAvailableKeys();
    let lastError: unknown;

    for (let i = 0; i < keys.length; i++) {
      const startTime = Date.now();
      try {
        const client = getClient(keys[i]);
        const response = await client.models.generateContent({
          model: modelOverride,
          contents: req.prompt,
          config: {
            systemInstruction: req.systemInstruction,
            temperature: req.temperature,
            maxOutputTokens: req.maxTokens,
          },
        });

        return {
          text: response.text || "",
          provider: this.name,
          model: modelOverride,
          usage: {
            inputTokens: response.usageMetadata?.promptTokenCount ?? null,
            outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
            totalTokens: response.usageMetadata?.totalTokenCount ?? null,
            estimatedCost: null,
            currency: "USD"
          },
          latencyMs: Date.now() - startTime,
          requestId: null,
          fallbackUsed: i > 0,
        };
      } catch (error) {
        lastError = error;
        const errMsg = error instanceof Error ? error.message : String(error);
        console.warn(`[Gemini] Key ${i + 1}/${keys.length} failed: ${errMsg.slice(0, 100)}`);

        if (isRateLimitError(error)) markKeyRateLimited(keys[i]);
        if (error instanceof AIGatewayError && !error.isTransient) throw error;
        if (isRetryableError(error) && i < keys.length - 1) continue;
        if (error instanceof AIGatewayError) throw error;
        throw mapError(error);
      }
    }
    throw mapError(lastError);
  }
}
