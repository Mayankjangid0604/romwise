/**
 * Validates a post-login `callbackUrl` so it can only point back into this app.
 *
 * The proxy sends signed-out users to `/login?callbackUrl=<path>` (e.g. an invite
 * link `/trips/join/<token>`); honouring it is what lets them land where they were
 * going. Anything that could leave the origin (absolute URLs, protocol-relative
 * `//host`, backslash tricks, control characters) or loop back into the auth pages
 * falls back to the dashboard.
 */
export const DEFAULT_AFTER_LOGIN = "/dashboard";

export function safeCallbackUrl(raw: unknown, fallback: string = DEFAULT_AFTER_LOGIN): string {
  if (typeof raw !== "string") return fallback;
  const value = raw.trim();
  if (value.length === 0 || value.length > 512) return fallback;
  if (!value.startsWith("/")) return fallback; // relative paths only
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback; // protocol-relative
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;

  // Resolve against a dummy origin to normalise dot-segments and catch anything exotic
  let url: URL;
  try {
    url = new URL(value, "http://roamwise.invalid");
  } catch {
    return fallback;
  }
  if (url.origin !== "http://roamwise.invalid") return fallback;
  if (/^\/(login|signup)(\/|$)/.test(url.pathname) || url.pathname.startsWith("/api/auth")) {
    return fallback;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
