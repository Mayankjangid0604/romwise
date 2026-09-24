/**
 * Shared validation error class.
 * 
 * Used across the application for input validation failures
 * (e.g., invalid API request bodies, malformed user inputs).
 * 
 * Not for AI/network errors — use AIGatewayError for those.
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
