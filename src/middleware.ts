/**
 * Zero-dependency Edge middleware.
 *
 * Uses the Web Crypto API (built into the Edge runtime — zero bundle cost)
 * to decrypt and validate the NextAuth v5 session token (JWE).
 *
 * NextAuth v5 encrypts session tokens using:
 *   - Algorithm : dir (direct key agreement)
 *   - Encryption : A256CBC-HS512
 *   - Key source : HKDF-SHA256 from AUTH_SECRET
 */
import { NextRequest, NextResponse } from "next/server";

// ─── HKDF key derivation (matches @auth/core internals) ─────────────────────

const ENCRYPTION_INFO = "Auth.js Generated Encryption Key";

async function getDerivedKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    "HKDF",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: enc.encode(ENCRYPTION_INFO),
    },
    keyMaterial,
    { name: "AES-CBC", length: 256 },
    false,
    ["decrypt"],
  );
}

// ─── Base64url decoder ───────────────────────────────────────────────────────

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

// ─── Token validation ────────────────────────────────────────────────────────

async function isValidToken(token: string): Promise<boolean> {
  const secret = process.env.AUTH_SECRET;
  if (!secret || !token) return false;

  // Compact JWE format: header.encKey.iv.ciphertext.tag
  const parts = token.split(".");
  if (parts.length !== 5) return false;

  try {
    const key = await getDerivedKey(secret);
    const iv = base64urlDecode(parts[2]);
    const ciphertext = base64urlDecode(parts[3]);
    // AUTH tag is appended to ciphertext for AES-CBC JWE
    const combined = new Uint8Array(ciphertext.length + 16);
    combined.set(ciphertext);
    combined.set(base64urlDecode(parts[4]), ciphertext.length);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-CBC", iv: iv.slice() },
      key,
      combined.slice(),
    );

    // Parse and check expiry
    const payload = JSON.parse(new TextDecoder().decode(decrypted));
    if (payload.exp && Date.now() / 1000 > payload.exp) return false;

    return true;
  } catch {
    return false;
  }
}

// ─── Middleware ──────────────────────────────────────────────────────────────

export async function middleware(req: NextRequest) {
  // NextAuth v5 cookie names
  const token =
    req.cookies.get("__Secure-authjs.session-token")?.value ??
    req.cookies.get("authjs.session-token")?.value;

  if (!await isValidToken(token ?? "")) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/trips/:path*",
    "/api/discovery",
    "/api/group-alignment",
  ],
};
